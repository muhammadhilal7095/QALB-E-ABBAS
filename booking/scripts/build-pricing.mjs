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
    : `<a class="btn btn--outline btn--sm" href="/book-consultation?topic=${esc(topic)}">Get a quote</a>`;
  // Optional explanation fields (catalog): icon, includes[], bestFor, delivery.
  const head = item.icon
    ? `<div class="pr-item__head"><span class="pr-item__icon">${icon(item.icon)}</span><h4 class="pr-item__name">${esc(item.name)}</h4></div>`
    : `<h4 class="pr-item__name">${esc(item.name)}</h4>`;
  const includes = item.includes?.length
    ? `<p class="pr-item__label">What's included</p><ul class="pr-item__list">${item.includes.map((x) => `<li>${icon("check")}<span>${esc(x)}</span></li>`).join("")}</ul>`
    : "";
  const meta = [item.bestFor ? `<li>${icon("users")}<span><b>Best for:</b> ${esc(item.bestFor)}</span></li>` : "", item.delivery ? `<li>${icon("clock")}<span><b>Delivery:</b> ${esc(item.delivery)}</span></li>` : ""].join("");
  return `<article class="pr-item${item.includes?.length ? " pr-item--detailed" : ""}">
              ${head}
              ${price}
              ${item.desc ? `<p class="pr-item__desc">${esc(item.desc)}</p>` : ""}${includes}${meta ? `<ul class="pr-item__meta">${meta}</ul>` : ""}${item.note ? `<p class="pr-item__note">${icon("info")}${esc(item.note)}</p>` : ""}
              <div class="pr-item__action">${action}</div>
            </article>`;
}

function section(key, page) {
  const groups = page.groups.map((g) => {
    const cur = g.currency || page.currency;
    return `<div class="pr-group">
          <h3 class="pr-group__title">${esc(g.title)}</h3>${g.desc ? `\n          <p class="pr-group__desc">${esc(g.desc)}</p>` : ""}
          <div class="pr-grid">
            ${g.items.map((i) => itemCard(i, cur, page.topic)).join("\n            ")}
          </div>
        </div>`;
  }).join("\n        ");

  let quarters = "";
  if (page.quarters) {
    const q = page.quarters;
    const QC = catalog.quarterContent || {};
    const cards = ["Q1", "Q2", "Q3", "Q4"].map((n) => {
      const item = { sku: `${q.skuPrefix}-${n.toLowerCase()}`, name: `${q.label} — ${n} (20 products)`, price: q.price };
      const [months, ...rest] = String(QC[n] || "").split(": ");
      return `<article class="rq-card">
              <div class="rq-card__band"><span class="rq-card__q">${n}</span><span class="rq-card__months">${esc(months || "")}</span></div>
              <div class="rq-card__body">
                ${rest.length ? `<p class="rq-card__desc">${esc(rest.join(": "))}</p>` : ""}
                <p class="rq-card__count">${icon("check-circle")}20 researched products</p>
                <div class="rq-card__foot"><p class="rq-card__price">${money(q.price, page.currency)}<span>/ report</span></p></div>
                <button type="button" class="rq-card__add" ${addAttrs(item, page.currency)} aria-label="Add to cart: ${n} product research">${icon("cart")}<span>Add to cart</span></button>
              </div>
            </article>`;
    }).join("\n            ");
    const incIcons = ["search", "chart", "receipt", "box"];
    const inc = (q.includes || []).map((x, i) => `<li><span class="rq-feat__icon">${icon(incIcons[i % incIcons.length])}</span><span>${esc(x)}</span></li>`).join("");
    quarters = `
        <div class="rq">
          <header class="rq__head">
            <p class="rq__eyebrow">${icon("search")}Product research reports</p>
            <h3>${esc(q.label)}</h3>
            <p>Each quarter we research 20 high-demand products for that season, so you can choose what to sell with evidence, not guesswork.</p>
            <ol class="rq__steps"><li><b>1</b>Pick a quarter</li><li><b>2</b>We research 20 products</li><li><b>3</b>Get your report and choose</li></ol>
          </header>${inc ? `
          <ul class="rq-feat" aria-label="What you get in each report">${inc}</ul>` : ""}
          <div class="rq__list">
            ${cards}
          </div>
          <p class="rq__tip">${icon("info")}Tip: order 2–3 months before the season, so there's time to source samples and have stock ready when demand starts.</p>
        </div>`;
  }

  // The "Not sure where to start?" box and the secure-payment line are no longer shown on any page.

  return `${START}
    <section class="section svc-pricing" id="pricing" aria-labelledby="pricing-title">
      <div class="container">
        <header class="section-head">
          <p class="eyebrow">Pricing</p>
          <h2 id="pricing-title" class="section-title">${esc(page.title)}</h2>
          <p class="section-sub">${esc(page.sub)}</p>
        </header>
        ${groups}${quarters}
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

// ---- Book a Consultation form: consultation choices with prices -------------------------
{
  const file = join(SITE, "book-consultation.html");
  let html = readFileSync(file, "utf8");
  const opts = catalog.consultations.types.map((c) =>
    `<option value="${esc(c.slug)}" data-price="${c.price}" data-currency="${c.currency}" data-minutes="${c.minutes}" data-desc="${esc(c.desc)}" data-topics="${esc(c.topics.join(" "))}">${esc(c.name)} — ${money(c.price, c.currency)} · ${c.minutes} min</option>`
  ).join("\n              ");
  const block = `<!-- CONSULTATIONS:START — generated from booking/src/lib/service-catalog.json; run \`npm run pricing:build\` -->\n              ${opts}\n              <!-- CONSULTATIONS:END -->`;
  if (!html.includes("<!-- CONSULTATIONS:START")) throw new Error("book-consultation.html: CONSULTATIONS markers missing");
  html = html.replace(/<!-- CONSULTATIONS:START[\s\S]*?<!-- CONSULTATIONS:END -->/, block);
  // Booking hours for the form (from catalog.availability).
  html = html.replace(/<form class="form bk-form" id="bk-form"[^>]*>/, `<form class="form bk-form" id="bk-form" data-availability='${JSON.stringify({ ...catalog.availability, _note: undefined })}' novalidate>`);
  writeFileSync(file, html);
  console.log(`✓ book-consultation.html (${catalog.consultations.types.length} consultation types)`);
}

// ---------------------------------------------------------------------------
// US LLC page: "Choose your state" selector (catalog.usStateFees). The page script
// assets/js/us-llc-states.js reads the JSON below, shows the fee and totals, and makes
// each package's Add to Cart button add the package together with that state's fee.
// ---------------------------------------------------------------------------
{
  const fees = catalog.usStateFees;
  const file = join(SITE, catalog.pages["us-llc"].file);
  let html = readFileSync(file, "utf8");
  const S_START = "<!-- US-STATES:START — generated from booking/src/lib/service-catalog.json (usStateFees); run `npm run pricing:build` -->";
  const S_END = "<!-- US-STATES:END -->";
  const byName = [...fees.states].sort((a, b) => a.name.localeCompare(b.name));
  const opt = (s) => `<option value="${s.code}"${s.code === fees.default ? " selected" : ""}>${esc(s.name)} — ${money(s.fee, "USD")} state fee</option>`;
  const popular = fees.popular.map((c) => fees.states.find((s) => s.code === c)).filter(Boolean);
  const def = fees.states.find((s) => s.code === fees.default);
  const data = JSON.stringify(fees.states.map(({ code, name, fee, note }) => ({ code, name, fee, ...(note ? { note } : {}) }))).replace(/</g, "\\u003c");
  const block = `${S_START}
        <div class="llc-state" data-llc-states>
          <div class="llc-state__pick">
            <label class="llc-state__label" for="llc-state-select"><span class="llc-state__step">1</span>Choose the state for your LLC</label>
            <select id="llc-state-select" class="llc-state__select" data-llc-select>
              <optgroup label="Popular with non-residents">${popular.map(opt).join("")}</optgroup>
              <optgroup label="All states (A–Z)">${byName.map(opt).join("")}</optgroup>
            </select>
            <div class="llc-state__chips" role="group" aria-label="Popular states">${popular.map((s) => `<button type="button" class="llc-state__chip" data-llc-chip="${s.code}">${esc(s.name)}</button>`).join("")}</div>
          </div>
          <div class="llc-state__info" aria-live="polite">
            <p class="llc-state__fee"><span><span class="llc-state__step">2</span><b data-llc-name>${esc(def.name)}</b> state filing fee</span><strong data-llc-fee>${money(def.fee, "USD")}</strong></p>
            <p class="llc-state__note" data-llc-note${def.note ? "" : " hidden"}>${def.note ? esc(def.note) : ""}</p>
            <p class="llc-state__small">Paid to the state when we file your Articles of Organization. Fees checked ${esc(fees.checked)} — we confirm the current fee before filing.</p>
          </div>
          <script type="application/json" id="us-state-fees">${data}</script>
        </div>
        ${S_END}`;
  if (html.includes("<!-- US-STATES:START")) html = html.replace(/<!-- US-STATES:START[\s\S]*?<!-- US-STATES:END -->/, () => block);
  else html = html.replace(/(<div class="plans plans--2">)/, (m) => `${block}\n        ${m}`);
  if (!html.includes("<!-- US-STATES:START")) throw new Error("US LLC page: could not place the state selector");
  writeFileSync(file, html);
  console.log(`✓ ${catalog.pages["us-llc"].file} (state selector, ${fees.states.length} states)`);
}
