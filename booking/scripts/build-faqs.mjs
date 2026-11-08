// Writes the FAQs from scripts/service-faqs.json into every service page (10 per page).
//
//   npm run faqs:build      (from the booking folder; then run `npm run schema:build`)
//
// The question list sits between <!-- FAQ:START --> and <!-- FAQ:END -->. On the first run a page's
// existing <div class="faq"> list is replaced; a page with no FAQs gets a new FAQ section before
// its closing call-to-action section.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const data = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "service-faqs.json"), "utf8"));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const START = "<!-- FAQ:START — generated from booking/scripts/service-faqs.json; run `npm run faqs:build` -->";
const END = "<!-- FAQ:END -->";
const chevron = '<svg class="icon" aria-hidden="true"><use href="#i-chevron-down"></use></svg>';

// Two columns: first half on the left, second half on the right (stacks on phones).
const item = ([q, a]) => `<details><summary>${esc(q)}${chevron}</summary><div><p>${esc(a)}</p></div></details>`;
const list = (faqs) => {
  const half = Math.ceil(faqs.length / 2);
  return `${START}<div class="faq-cols"><div class="faq">${faqs.slice(0, half).map(item).join("")}</div>` +
    `<div class="faq">${faqs.slice(half).map(item).join("")}</div></div>${END}`;
};

// Index just past the </div> that closes the <div ...> opening at `from`.
function closeDiv(html, from) {
  const re = /<div\b[^>]*>|<\/div>/g;
  re.lastIndex = from;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === "/" ? -1 : 1;
    if (depth === 0) return re.lastIndex;
  }
  throw new Error("unbalanced <div>");
}

let updated = 0;
const problems = [];
for (const [page, { title, faqs }] of Object.entries(data)) {
  if (page.startsWith("_")) continue;
  if (faqs.length !== 10) problems.push(`${page}: ${faqs.length} FAQs (expected 10)`);
  const file = join(SITE, `${page}.html`);
  let html = readFileSync(file, "utf8");
  const block = list(faqs);
  const main = html.indexOf("<main");

  if (html.includes("<!-- FAQ:START")) {
    html = html.replace(/<!-- FAQ:START[\s\S]*?<!-- FAQ:END -->/, () => block);
  } else if (html.indexOf('<div class="faq">', main) !== -1) {
    const at = html.indexOf('<div class="faq">', main);
    html = html.slice(0, at) + block + html.slice(closeDiv(html, at));
  } else {
    const section =
      `<section class="section mp-faq" aria-labelledby="faq-title">\n` +
      `      <div class="container">\n` +
      `        <header class="section-head"><p class="eyebrow">FAQs</p><h2 id="faq-title" class="section-title">${esc(title)}</h2></header>\n` +
      `        ${block}\n` +
      `      </div>\n` +
      `    </section>\n\n    `;
    const at = html.lastIndexOf("<section", html.indexOf("</main>"));
    if (at < main) { problems.push(`${page}: no section to insert before`); continue; }
    html = html.slice(0, at) + section + html.slice(at);
  }
  writeFileSync(file, html);
  updated++;
}
console.log(`FAQs written to ${updated} service pages.`);
if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; }
