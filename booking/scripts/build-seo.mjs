// Writes SEO head tags to every page, plus sitemap.xml and robots.txt, from scripts/seo-pages.json.
//
//   npm run seo:build       (from the booking folder; then run `npm run schema:build`)
//
// Per page: <title>, meta description, canonical URL, robots, Open Graph and Twitter tags.
// They sit between <!-- SEO:START --> and <!-- SEO:END --> right after the viewport meta tag.
// Pages marked "noindex" get <meta name="robots" content="noindex, follow"> and stay out of the sitemap.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, "..", "..");
// The live website address (keep in sync with build-schema.mjs).
const SITE_URL = "https://www.qalbeabbas.com";
const DEFAULT_IMAGE = "assets/img/hero/amazon-seller.jpg";

const data = JSON.parse(readFileSync(join(HERE, "seo-pages.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const START = "<!-- SEO:START — generated from booking/scripts/seo-pages.json; run `npm run seo:build` -->";
const END = "<!-- SEO:END -->";

const pages = readdirSync(SITE).filter((f) => f.endsWith(".html") && !f.startsWith("_")).map((f) => f.slice(0, -5));
const missing = pages.filter((p) => !data[p]);
const today = new Date().toISOString().slice(0, 10);
// <lastmod> only changes when a page's visible content (<main>) changes: hashes are kept in seo-lastmod.json.
const LASTMOD_FILE = join(HERE, "seo-lastmod.json");
const lastmod = existsSync(LASTMOD_FILE) ? JSON.parse(readFileSync(LASTMOD_FILE, "utf8")) : {};
const site = data._site || {};
const sitemap = [];
const warnings = [];

for (const page of pages) {
  const seo = data[page];
  if (!seo) continue;
  if (seo.title.length > 62) warnings.push(`${page}: title is ${seo.title.length} characters (aim for 50–60)`);
  if (seo.description.length > 165) warnings.push(`${page}: description is ${seo.description.length} characters (aim for 140–160)`);

  const file = join(SITE, `${page}.html`);
  let html = readFileSync(file, "utf8");
  const url = page === "index" ? `${SITE_URL}/` : `${SITE_URL}/${page}`;

  // Share image: the page's first photo (hero/banner), else the default.
  const main = html.slice(html.indexOf("<main"));
  const photoTag = main.match(/<img[^>]+src="(assets\/img\/[^"]+\.(?:jpe?g|png|webp))"[^>]*>/);
  // Social networks get the JPG version (WebP isn't supported everywhere for link previews).
  const photo = (photoTag ? photoTag[1] : DEFAULT_IMAGE).replace(/\.webp$/, ".jpg");
  const image = `${SITE_URL}/${photo}`;
  const attr = (name) => (photoTag && (photoTag[0].match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1]) || "";
  const imageAlt = attr("alt") || seo.title;

  const tags = [
    `<title>${esc(seo.title)}</title>`,
    `<meta name="description" content="${esc(seo.description)}">`,
    `<meta name="robots" content="${seo.noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="${seo.type || (html.includes('<p class="byline">') ? "article" : "website")}">`,
    `<meta property="og:site_name" content="Qalb-E-Abbas">`,
    `<meta property="og:locale" content="en_GB">`,
    `<meta property="og:title" content="${esc(seo.title)}">`,
    `<meta property="og:description" content="${esc(seo.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:image:alt" content="${esc(imageAlt)}">`,
    ...(attr("width") && attr("height") ? [`<meta property="og:image:width" content="${attr("width")}">`, `<meta property="og:image:height" content="${attr("height")}">`] : []),
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(seo.title)}">`,
    `<meta name="twitter:description" content="${esc(seo.description)}">`,
    `<meta name="twitter:image" content="${image}">`,
    `<meta name="twitter:image:alt" content="${esc(imageAlt)}">`,
    // Preload the page's main hero photo (the Largest Contentful Paint element) so it starts downloading early.
    ...(() => {
      const hero = main.match(/<img[^>]*fetchpriority="high"[^>]*>/);
      if (!hero) return [];
      const g = (n) => (hero[0].match(new RegExp(`\\b${n}="([^"]*)"`)) || [])[1];
      const src = g("src"), set = g("srcset"), sizes = g("sizes");
      return src ? [`<link rel="preload" as="image" href="${src}"${set ? ` imagesrcset="${set}"` : ""}${sizes ? ` imagesizes="${sizes}"` : ""} fetchpriority="high">`] : [];
    })(),
    // Google Search Console ownership (homepage only) — set _site.googleSiteVerification in seo-pages.json.
    ...(page === "index" && site.googleSiteVerification ? [`<meta name="google-site-verification" content="${esc(site.googleSiteVerification)}">`] : []),
  ];
  const block = `${START}\n  ${tags.join("\n  ")}\n  ${END}`;

  if (html.includes("<!-- SEO:START")) {
    html = html.replace(/<!-- SEO:START[\s\S]*?<!-- SEO:END -->/, () => block);
  } else {
    // First run: remove the old hand-written tags so nothing is duplicated.
    const head = html.slice(0, html.indexOf("</head>"));
    const cleaned = head
      .replace(/^[ \t]*<title>[\s\S]*?<\/title>[ \t]*\n/m, "")
      .replace(/^[ \t]*<meta name="(?:description|robots|keywords|twitter:[a-z]+)"[^>]*>[ \t]*\n/gm, "")
      .replace(/^[ \t]*<meta property="og:[a-z_:]+"[^>]*>[ \t]*\n/gm, "")
      .replace(/^[ \t]*<link rel="canonical"[^>]*>[ \t]*\n/gm, "");
    html = cleaned.replace(/(<meta name="viewport"[^>]*>\n)/, (m) => `${m}  ${block}\n`) + html.slice(head.length);
    if (!html.includes("<!-- SEO:START")) { warnings.push(`${page}: no viewport meta tag, tags not added`); continue; }
  }
  writeFileSync(file, html);
  // Photos on the page (not logos/icons), listed in the sitemap so Google Images can index them.
  const images = [...new Set([...main.matchAll(/<img[^>]+src="(assets\/img\/[^"]+\.(?:jpe?g|png|webp))"/g)].map((m) => `${SITE_URL}/${m[1]}`))];
  const hash = createHash("sha1").update(main.replace(/\?v=\d+/g, "").replace(/\.(webp|jpe?g)/g, "")).digest("hex").slice(0, 12);
  if (!lastmod[page] || lastmod[page].hash !== hash) lastmod[page] = { hash, date: today };
  if (!seo.noindex) sitemap.push({ url, priority: seo.priority || "0.5", images, date: lastmod[page].date });
}

sitemap.sort((a, b) => b.priority - a.priority || a.url.localeCompare(b.url));
writeFileSync(join(SITE, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
  sitemap.map((s) => `  <url><loc>${s.url}</loc><lastmod>${s.date}</lastmod><priority>${s.priority}</priority>` +
    s.images.map((i) => `\n    <image:image><image:loc>${i}</image:loc></image:image>`).join("") +
    (s.images.length ? "\n  " : "") + `</url>`).join("\n") +
  `\n</urlset>\n`);
writeFileSync(LASTMOD_FILE, JSON.stringify(lastmod, null, 1) + "\n");
writeFileSync(join(SITE, "robots.txt"),
  // Pages like /cart are kept out with "noindex" (not Disallow), so Google can still read that tag.
  // /admin is the private dashboard; /sitemap-blog.xml lists posts written in Admin → Blog.
  `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${SITE_URL}/sitemap.xml\nSitemap: ${SITE_URL}/sitemap-blog.xml\n`);

console.log(`SEO tags written to ${pages.length - missing.length} pages; sitemap.xml lists ${sitemap.length} pages and ${sitemap.reduce((n, s) => n + s.images.length, 0)} images.`);
if (missing.length) console.warn(`No SEO entry (skipped): ${missing.join(", ")}`);
if (warnings.length) console.warn(warnings.join("\n"));
