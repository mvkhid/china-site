import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SRC = "C:/Users/Аюб/Documents/китай/preview-opt.html";
const OUT_DIR = "C:/Users/Аюб/Documents/китай/site";

const html = readFileSync(SRC, "utf8");

// 1. CSS
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error("style block not found");
const css = styleMatch[1];

// 2. Body markup (between <body> and first <script>)
const bodyStart = html.indexOf("<body>") + "<body>".length;
const firstScript = html.indexOf("<script>");
let bodyHtml = html.slice(bodyStart, firstScript).trim();

// 3. Scripts (concat all <script>...</script> blocks after body markup)
const scriptRe = /<script>([\s\S]*?)<\/script>/g;
let scripts = "";
let m;
const afterBody = html.slice(firstScript);
while ((m = scriptRe.exec(afterBody))) {
  scripts += m[1] + "\n";
}

// 4. Extract base64 images from bodyHtml, replace with file paths
const imgRe = /data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/g;
let idx = 0;
const proofCaptions = [
  "check-1", "check-2", "check-3", "check-4", "check-5", "check-6", "check-7",
];
const seen = [];

mkdirSync(OUT_DIR + "/public/proof", { recursive: true });

bodyHtml = bodyHtml.replace(imgRe, (full, b64) => {
  idx++;
  let filePath;
  if (idx === 1) {
    // единственное фото — "Обо мне"
    filePath = "/about.jpg";
    writeFileSync(OUT_DIR + "/public/about.jpg", Buffer.from(b64, "base64"));
  } else {
    const proofIndex = (idx - 2) % 7; // 0..6, wraps for duplicate marquee set
    filePath = `/proof/${proofCaptions[proofIndex]}.jpg`;
    if (!seen[proofIndex]) {
      writeFileSync(OUT_DIR + `/public/proof/${proofCaptions[proofIndex]}.jpg`, Buffer.from(b64, "base64"));
      seen[proofIndex] = true;
    }
  }
  return filePath;
});

writeFileSync(OUT_DIR + "/app/globals.css", css, "utf8");
writeFileSync(OUT_DIR + "/lib/legacy-markup.html", bodyHtml, "utf8");
writeFileSync(OUT_DIR + "/lib/legacy-script.js", scripts, "utf8");

console.log("images replaced:", idx);
console.log("css length:", css.length);
console.log("bodyHtml length:", bodyHtml.length);
console.log("scripts length:", scripts.length);
