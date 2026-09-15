export interface Tier {
  threshold: number;
  rate: number;
}

export interface RateData {
  tiers: Tier[];
  publishedAt: string;
  updatedAt: string;
  sourcePostId: string;
}

interface ParseCandidate {
  postId: string;
  headerDate: string | null;
  publishedAt: string;
  tiers: Tier[];
}

const CHANNEL_URL = "https://t.me/s/reseller_rmb";
const POST_MARKER = 'data-post="reseller_rmb/';
const TIER_RE = /от\s+([\d\s]{1,7})¥\s*[—–-]\s*([\d]+(?:[.,]\d+)?)\s*₽/g;
const HEADER_RE = /курс\s*(\d{1,2})\.(\d{1,2})/i;
const TIME_RE = /<time\s+datetime="([^"]+)"/i;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
}

function extractCandidates(html: string): ParseCandidate[] {
  const chunks = html.split(POST_MARKER).slice(1);
  const candidates: ParseCandidate[] = [];

  for (const raw of chunks) {
    const idEnd = raw.indexOf('"');
    if (idEnd === -1) continue;
    const postId = raw.slice(0, idEnd);
    const chunk = raw.slice(idEnd);

    const headerMatch = chunk.match(HEADER_RE);
    const timeMatch = chunk.match(TIME_RE);
    if (!timeMatch) continue;

    const window = chunk.slice(0, chunk.indexOf(timeMatch[0]) + 200);
    const plain = stripTags(window);

    const tiers: Tier[] = [];
    let m: RegExpExecArray | null;
    TIER_RE.lastIndex = 0;
    while ((m = TIER_RE.exec(plain))) {
      const threshold = parseInt(m[1].replace(/\s/g, ""), 10);
      const rate = parseFloat(m[2].replace(",", "."));
      tiers.push({ threshold, rate });
    }

    candidates.push({
      postId,
      headerDate: headerMatch ? `${headerMatch[1]}.${headerMatch[2]}` : null,
      publishedAt: timeMatch[1],
      tiers,
    });
  }

  return candidates;
}

function isValidCandidate(c: ParseCandidate): boolean {
  if (c.tiers.length !== 3) return false;
  const [a, b, cc] = c.tiers;
  if (!(a.threshold < b.threshold && b.threshold < cc.threshold)) return false;
  for (const t of c.tiers) {
    if (!Number.isFinite(t.rate) || t.rate <= 1 || t.rate >= 100) return false;
    if (!Number.isFinite(t.threshold) || t.threshold <= 0) return false;
  }
  if (Number.isNaN(Date.parse(c.publishedAt))) return false;
  return true;
}

export interface ParseResult {
  ok: true;
  data: RateData;
  warning?: string;
}

export interface ParseFailure {
  ok: false;
  error: string;
}

export async function fetchAndParseRate(fetchImpl: typeof fetch = fetch): Promise<ParseResult | ParseFailure> {
  let html: string;
  try {
    const res = await fetchImpl(CHANNEL_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });
    if (!res.ok) {
      return { ok: false, error: `fetch failed: http ${res.status}` };
    }
    html = await res.text();
  } catch (e) {
    return { ok: false, error: `fetch threw: ${(e as Error).message}` };
  }

  const candidates = extractCandidates(html);
  if (candidates.length === 0) {
    return { ok: false, error: "no candidate posts found — channel markup may have changed" };
  }

  // Посты идут от старых к новым, берём последний валидный с конца.
  for (let i = candidates.length - 1; i >= 0; i--) {
    const c = candidates[i];
    if (!isValidCandidate(c)) continue;

    let warning: string | undefined;
    if (c.headerDate) {
      const [dd, mm] = c.headerDate.split(".").map(Number);
      const d = new Date(c.publishedAt);
      if (d.getUTCDate() !== dd || d.getUTCMonth() + 1 !== mm) {
        warning = `header date ${c.headerDate} does not match post timestamp ${c.publishedAt}`;
      }
    }

    const sorted = [...c.tiers].sort((x, y) => x.threshold - y.threshold);

    return {
      ok: true,
      data: {
        tiers: sorted,
        publishedAt: c.publishedAt,
        updatedAt: new Date().toISOString(),
        sourcePostId: c.postId,
      },
      warning,
    };
  }

  return { ok: false, error: "found posts but none passed validation (format changed?)" };
}
