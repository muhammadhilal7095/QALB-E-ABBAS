// Generates the "Pricing" section (with Add to cart buttons) on each service page of the
// marketing website from src/lib/service-catalog.json — the same file the booking app
// charges from, so displayed and charged prices can never drift apart.
//
//   npm run pricing:build        (run from the booking folder after editing the catalog)
//
// Each generated block sits between <!-- PRICING:START --> and <!-- PRICING:END --> markers
// and is replaced on every run. Pages in "plans" mode keep their hand-written plan cards;
// only their buttons carry data-add-to-cart attributes (see the page HTML).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = join(here, "..", "..");
const catalog = JSON.parse(readFileSync(join(here, "..", "src", "lib", "service-catalog.json"), "utf8"));

const SYMBOL = { USD: "$", GBP: "£", EUR: "€" };
const money = (n, cur) => `${SYMBOL[cur] ?? cur + " "}${Number(n).toLocaleString("en-US")}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const icon = (n) => `<svg class="icon" aria-hidden="true"><use href="#i-${n}"></use></svg>`;
const START = "<!-- PRICING:START — generated from booking/src/lib/service-catalog.json; edit the catalog and run `npm run pricing:build` -->";
const END = "<!-- PRICING:END -->";

function addAttrs(item, cur) {
  const multi = !!item.unit && !item.fixedQty;
  return `data-add-to-cart data-sku="${esc(item.sku)}" data-name="${esc(item.name)}" data-price="${item.price}" data-currency="${cur}"` +
    (item.unit ? ` data-unit="${esc(item.unit)}"` : "") + (multi ? ` data-multi="1"` : "") +
    (item.from ? ` data-note="Starting price"` : item.note ? ` data-note="${esc(item.note)}"` : "");
}

function itemCard(item, cur, topic) {
  const priced = item.price != null;
  const price = priced
    ? `<p class="pr-item__price">${item.from ? '<span class="pr-item__from">From</span>' : ""}${money(item.price, cur)}${item.unit ? `<span class="pr-item__unit">${esc(item.unit)}</span>` : ""}</p>`
    : `<p class="pr-item__price pr-item__price--quote">Price on request</p>`;
  const action = priced
    ? `<button type="button" class="btn btn--primary btn--sm pr-add" ${addAttrs(item, cur)}>${icon("cart")}Add to cart</button>`
    : `<a class="btn btn--outline btn--sm" href="book-consultation.html?topic=${esc(topic)}">Get a quote</a>`;
  return `<article class="pr-item">
              <h4 class="pr-item__name">${esc(item.name)}</h4>
              ${price}
              ${item.desc ? `<p class="pr-item__desc">${esc(item.desc)}</p>` : ""}${item.note ? `<p class="pr-item__note">${icon("info")}${esc(item.note)}</p>` : ""}
              <div class="pr-item__action">${action}</div>
            </article>`;
}

function section(key, page) {
  const groups = page.groups.map((g) => {
    const cur = g.currency || page.currency;
    return `<div class="pr-group">
          <h3 class="pr-group__title">${esc(g.title)}</h3>
          <div class="pr-grid">
            ${g.items.map((i) => itemCard(i, cur, page.topic)).join("\n            ")}
          </div>
        </div>`;
  }).join("\n        ");

  let quarters = "";
  if (page.quarters) {
    const q = page.quarters;
    const chips = ["Q1", "Q2", "Q3", "Q4"].map((n) => {
      const item = { sku: `${q.skuPrefix}-${n.toLowerCase()}`, name: `${q.label} — ${n} (20 products)`, price: q.price };
      return `<div class="pr-q"><span class="pr-q__name">${n}</span><span class="pr-q__price">${money(q.price, page.currency)}</span><button type="button" class="pr-q__add" ${addAttrs(item, page.currency)} aria-label="Add ${n} product research to cart">${icon("cart")}<span>Add</span></button></div>`;
    }).join("");
    quarters = `
        <div class="pr-quarters">
          <div class="pr-quarters__text">
            <span class="pr-quarters__icon">${icon("search")}</span>
            <div><h3>${esc(q.label)}</h3><p>A researched list of 20 high-demand products for each quarter of the year — ${money(q.price, page.currency)} per quarter.</p></div>
          </div>
          <div class="pr-quarters__list">${chips}</div>
        </div>`;
  }

  const consult = catalog.consultation.pages.includes(key)
    ? `
        <div class="pr-consult">
          <span class="pr-consult__icon">${icon("headset")}</span>
          <p><strong>Not sure where to start?</strong><span>Book a 1:1 consultation with our team for ${money(catalog.consultation.price, catalog.consultation.currency)}.</span></p>
          <a class="btn btn--accent" href="book-consultation.html?topic=${esc(page.topic)}">Book a Consultation${icon("arrow-right")}</a>
        </div>`
    : "";

  return `${START}
    <section class="section svc-pricing" id="pricing" aria-labelledby="pricing-title">
      <div class="container">
        <header class="section-head">
          <p class="eyebrow">Pricing</p>
          <h2 id="pricing-title" class="section-title">${esc(page.title)}</h2>
          <p class="section-sub">${esc(page.sub)}</p>
        </header>
        ${groups}${quarters}${consult}
        <p class="pr-secure">${icon("shield")}Secure checkout · Pay by card or bank transfer · <a href="cart.html">View your cart</a></p>
      </div>
    </section>
    ${END}`;
}

/** Wraps a page-cta box that lives inside the content section into its own closing section. */
function liftPageCta(html) {
  const i = html.indexOf('<div class="page-cta');
  if (i < 0 || html.includes('aria-label="Get started"')) return html;
  const lineEnd = html.indexOf("\n", i);
  const cta = html.slice(i, lineEnd);
  const opens = (cta.match(/<div\b/g) || []).length, closes = (cta.match(/<\/div>/g) || []).length;
  if (opens !== closes) throw new Error("page-cta block is not on a single balanced line");
  html = html.slice(0, i) + html.slice(lineEnd + 1);
  const mainEnd = html.indexOf("</main>");
  return html.slice(0, mainEnd) + `    <section class="section" aria-label="Get started">\n      <div class="container">\n        ${cta}\n      </div>\n    </section>\n  ` + html.slice(mainEnd);
}

let changed = 0;
for (const [key, page] of Object.entries(catalog.pages)) {
  if (page.mode === "plans") continue;
  const file = join(SITE, page.file);
  let html = readFileSync(file, "utf8");
  const block = section(key, page);
  if (html.includes("<!-- PRICING:START")) {
    html = html.replace(/<!-- PRICING:START[\s\S]*?<!-- PRICING:END -->/, block);
  } else if (/<section[^>]*id="pricing"/.test(html)) {
    const a = html.search(/<section[^>]*id="pricing"/);
    const b = html.indexOf("</section>", a) + "</section>".length;
    html = html.slice(0, a) + block + html.slice(b);
  } else {
    html = liftPageCta(html);
    let at;
    if (page.after) {
      const a = html.indexOf(`id="${page.after}"`);
      at = html.indexOf("</section>", a) + "</section>".length;
      html = html.slice(0, at) + "\n\n    " + block + html.slice(at);
    } else {
      const m = html.search(/<section[^>]*aria-label="Get started"/);
      if (m < 0) throw new Error(`${page.file}: no place to insert pricing`);
      html = html.slice(0, m) + block + "\n\n    " + html.slice(m);
    }
  }
  writeFileSync(file, html);
  changed++;
  console.log(`✓ ${page.file}`);
}
console.log(`Pricing sections updated on ${changed} pages.`);
