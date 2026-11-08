// Makes a WebP copy of every JPG/PNG photo in assets/img and points the website's <img> tags at it.
//
//   npm run images:build      (from the booking folder; run it after adding or replacing photos)
//
// WebP files are usually 25–35% smaller than JPG at the same quality, which speeds up page loads
// (Core Web Vitals). The original JPG/PNG files are kept: social share images (og:image) use them.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const IMG = join(SITE, "assets", "img");

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(jpe?g|png)$/i.test(name)) yield p;
  }
}

let made = 0, before = 0, after = 0;
for (const file of walk(IMG)) {
  const out = file.replace(/\.(jpe?g|png)$/i, ".webp");
  if (!existsSync(out) || statSync(out).mtimeMs < statSync(file).mtimeMs) {
    await sharp(file).webp({ quality: 80, effort: 5 }).toFile(out);
    made++;
  }
  before += statSync(file).size; after += statSync(out).size;
}

// Point <img src/srcset> in page bodies at the WebP versions (only where the .webp exists).
let pages = 0;
for (const f of readdirSync(SITE).filter((n) => n.endsWith(".html"))) {
  const path = join(SITE, f);
  const html = readFileSync(path, "utf8");
  const i = html.indexOf("<body");
  if (i < 0) continue;
  const body = html.slice(i).replace(/assets\/img\/[\w\/.-]+?\.(?:jpe?g|png)\b/g, (m) =>
    existsSync(join(SITE, m.replace(/\.(jpe?g|png)$/, ".webp"))) ? m.replace(/\.(jpe?g|png)$/, ".webp") : m);
  if (body !== html.slice(i)) { writeFileSync(path, html.slice(0, i) + body); pages++; }
}
const mb = (n) => (n / 1048576).toFixed(1) + " MB";
console.log(`WebP: ${made} new files; photos ${mb(before)} → ${mb(after)} as WebP (${Math.round((1 - after / before) * 100)}% smaller). ${pages} pages updated.`);
