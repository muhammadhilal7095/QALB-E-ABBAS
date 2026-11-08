// Minifies the website's CSS and JavaScript and points every page at the minified files.
//
//   npm run assets:build      (from the booking folder; run after editing assets/css or assets/js)
//
// Edit the readable source files (assets/css/styles.css, assets/js/*.js). This script writes
// styles.min.css and *.min.js next to them and sets each page's ?v= to a hash of the file's
// content, so browsers always fetch the newest version but can cache it for a year otherwise.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { transform } from "esbuild";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const hash = (s) => createHash("sha1").update(s).digest("hex").slice(0, 8);
const assets = [{ src: "assets/css/styles.css", loader: "css" }];
for (const f of readdirSync(join(SITE, "assets/js")).filter((n) => n.endsWith(".js") && !n.endsWith(".min.js")))
  assets.push({ src: `assets/js/${f}`, loader: "js" });

const versions = {};
let before = 0, after = 0;
for (const a of assets) {
  const code = readFileSync(join(SITE, a.src), "utf8");
  const out = await transform(code, { loader: a.loader, minify: true, target: a.loader === "js" ? "es2017" : undefined, legalComments: "none" });
  const min = a.src.replace(/\.(css|js)$/, ".min.$1");
  writeFileSync(join(SITE, min), out.code);
  versions[a.src] = { min, v: hash(out.code) };
  before += code.length; after += out.code.length;
}

let pages = 0;
for (const f of readdirSync(SITE).filter((n) => n.endsWith(".html"))) {
  const path = join(SITE, f);
  let html = readFileSync(path, "utf8");
  const orig = html;
  for (const [src, { min, v }] of Object.entries(versions)) {
    const base = src.replace(/\.(css|js)$/, "");
    const ext = src.endsWith(".css") ? "css" : "js";
    const re = new RegExp(`${base.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(?:\\.min)?\\.${ext}(?:\\?v=[\\w.]+)?(?=")`, "g");
    html = html.replace(re, `${min}?v=${v}`);
  }
  // Google Fonts: load the stylesheet without blocking the first paint (font-display: swap is already set).
  html = html.replace(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)">/,
    (m, url) => `<link rel="preload" as="style" href="${url}" onload="this.onload=null;this.rel='stylesheet'">\n  <noscript><link rel="stylesheet" href="${url}"></noscript>`);
  if (html !== orig) { writeFileSync(path, html); pages++; }
}
const kb = (n) => Math.round(n / 1024) + " KB";
console.log(`Minified ${assets.length} files: ${kb(before)} → ${kb(after)} (${Math.round((1 - after / before) * 100)}% smaller). ${pages} pages updated.`);
