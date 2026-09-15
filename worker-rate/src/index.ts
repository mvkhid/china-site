import { fetchAndParseRate, type RateData } from "./parse";

export interface Env {
  RATE_KV: KVNamespace;
  ALLOWED_ORIGIN: string;
  DEBUG_TOKEN?: string;
}

const KV_KEY = "current";

function corsHeaders(env: Env): HeadersInit {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=60",
  };
}

async function readRate(env: Env): Promise<RateData | null> {
  return env.RATE_KV.get<RateData>(KV_KEY, "json");
}

async function runParseAndStore(env: Env): Promise<void> {
  const result = await fetchAndParseRate();

  if (!result.ok) {
    console.error(`[rate] parse failed: ${result.error}`);
    return;
  }

  if (result.warning) {
    console.warn(`[rate] ${result.warning}`);
  }

  const existing = await readRate(env);
  if (existing && existing.publishedAt >= result.data.publishedAt) {
    console.log(`[rate] no new post (existing publishedAt=${existing.publishedAt})`);
    return;
  }

  await env.RATE_KV.put(KV_KEY, JSON.stringify(result.data));
  console.log(
    `[rate] updated: post ${result.data.sourcePostId}, publishedAt=${result.data.publishedAt}, tiers=${JSON.stringify(
      result.data.tiers
    )}`
  );
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runParseAndStore(env));
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (url.pathname === "/rate" && request.method === "GET") {
      const data = await readRate(env);
      if (!data) {
        return new Response(JSON.stringify({ error: "rate not available yet" }), {
          status: 503,
          headers: { "Content-Type": "application/json", ...corsHeaders(env) },
        });
      }
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json", ...corsHeaders(env) },
      });
    }

    if (url.pathname === "/parse-now" && request.method === "POST") {
      if (!env.DEBUG_TOKEN || request.headers.get("X-Debug-Token") !== env.DEBUG_TOKEN) {
        return new Response("not found", { status: 404, headers: corsHeaders(env) });
      }
      await runParseAndStore(env);
      const data = await readRate(env);
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json", ...corsHeaders(env) },
      });
    }

    return new Response("not found", { status: 404, headers: corsHeaders(env) });
  },
};
