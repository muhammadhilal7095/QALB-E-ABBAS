// Builds the website assistant's knowledge (assets/js/assistant-data.js) from the site itself:
// every service page (description + "How it works" steps), the price list (api/_catalog.json),
// the FAQs (service-faqs.json), consultation types and the University courses.
//
//   npm run assistant:build      (from the booking folder; also part of site:build)
//
// Extra answers you write in Admin → Assistant are added on top of this at runtime.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(SITE, p), "utf8");

const ent = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " ", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", hellip: "…", pound: "£", euro: "€", middot: "·" };
const text = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&(#?\w+);/g, (m, e) => ent[e] ?? (e[0] === "#" ? String.fromCharCode(Number(e.slice(1))) : m)).replace(/\s+/g, " ").trim();
const first = (re, s) => { const m = s.match(re); return m ? m[1] : ""; };

// Site config (window.SITE_CONFIG)
const ctx = { window: {} };
vm.runInNewContext(read("assets/js/site-config.js"), ctx);
const CFG = ctx.window.SITE_CONFIG;

const faqs = JSON.parse(read("booking/scripts/service-faqs.json"));
const catalog = JSON.parse(read("api/_catalog.json"));
const priceByFile = {};
for (const p of Object.values(catalog.pages)) priceByFile[p.file] = p;

// Service areas (same order as the Services page) and which area each page belongs to.
const areas = [];
const areaOf = {};
for (const a of CFG.services) {
  areas.push({ id: a.id, title: a.title, icon: a.icon, desc: a.desc, link: "/services#" + a.id, items: [] });
  for (const it of a.items) areaOf[it[2].replace(/^\//, "")] ??= a.id;
}
areas.splice(2, 0, { id: "taxation", title: "Taxation Services", icon: "receipt", desc: "UK accounts, US tax filings and trademark registration.", link: "/services#taxation", items: [] });
areaOf.taxation = "taxation";
areaOf["trademark-registration"] = "taxation";

// Extra search words (English + common Roman Urdu) so visitors find the right service.
const KEYWORDS = {
  "amazon-fba": "amazon fba fbm private label seller central brand registry ppc wholesale arbitrage",
  ebay: "ebay store",
  etsy: "etsy handmade print on demand pod digital products",
  "shopify-development": "shopify store dropshipping online store theme",
  "tiktok-shop": "tiktok shop tik tok social commerce live selling creators",
  walmart: "walmart wfs marketplace",
  "uk-ltd-formation": "uk ltd limited company companies house england britain registration register company",
  "us-llc-formation": "us usa llc america wyoming delaware new mexico florida texas state registered agent",
  "malta-company-formation": "malta company eu europe",
  "uae-company-formation": "uae dubai free zone mainland emirates company trade licence license",
  taxation: "tax taxes accounting accountant vat hmrc irs self assessment corporation tax 5472 1120 bookkeeping filing returns",
  "trademark-registration": "trademark brand name logo ipo uspto register brand",
  seo: "seo google ranking search engine optimisation optimization keywords",
  "digital-marketing": "ads advertising paid ads google ads meta ads facebook ads ppc campaigns",
  "social-media-marketing": "social media instagram facebook posts content management smm",
  "email-marketing": "email newsletter klaviyo mailchimp flows",
  "influencer-marketing": "influencer creators ugc",
  "affiliate-marketing": "affiliate commission partners",
  "facebook-automation": "facebook messenger chatbot automation bot",
  "instagram-automation": "instagram dm automation chatbot bot comments",
  "whatsapp-automation": "whatsapp chatbot automation bot business api",
  "tiktok-automation": "tiktok automation bot comments dm",
  "website-development": "website web site wordpress landing page design develop banwani",
  "app-development": "app mobile android ios application",
  "crm-development": "crm customer management software system portal",
  "education-consultancy": "study abroad malta university admission student education parhai",
  "stock-exchange": "stock stocks exchange psx kse kse100 kmi share shares trading trade invest investment investing investor nasdaq nyse lse ftse etf etfs mutual fund funds broker cdc roshan digital portfolio dividend dividends market",
  "pakistan-sourcing": "pakistan sourcing supplier manufacturer factory sialkot faisalabad karachi lahore textiles towels leather sports goods surgical instruments himalayan salt import",
  "turkey-sourcing": "turkey turkiye turkish sourcing supplier manufacturer factory istanbul bursa denizli izmir clothing textiles towels denim ceramics furniture import",
  "china-sourcing": "china sourcing supplier suppliers factory manufacturer alibaba 1688 import importing samples moq inspection qc private label freight shipping cheen maal",
  "real-estate": "property real estate plot house flat apartment rent invest pakistan lahore islamabad karachi zameen ghar makan",
};

// Clear names for chat answers (the menu's short labels like "UK" need context).
const LABELS = {
  "uk-ltd-formation": "UK LTD Formation", "us-llc-formation": "US LLC Formation", "uae-company-formation": "UAE Company Formation",
  "malta-company-formation": "Malta Company Formation", taxation: "US & UK Tax Filing", "trademark-registration": "Trademark Registration",
  "digital-marketing": "Paid Ads (PPC)", "social-media-marketing": "Social Media Marketing", "email-marketing": "Email Marketing",
  "influencer-marketing": "Influencer Marketing", "affiliate-marketing": "Affiliate Marketing", "facebook-automation": "Facebook Automation",
  "instagram-automation": "Instagram Automation", "whatsapp-automation": "WhatsApp Automation", "tiktok-automation": "TikTok Automation",
  "website-development": "Website Development", "app-development": "Mobile App Development", "crm-development": "CRM Development",
  "shopify-development": "Shopify Store", "real-estate": "Pakistan Real Estate", "china-sourcing": "China Product Sourcing", "pakistan-sourcing": "Pakistan Product Sourcing", "turkey-sourcing": "Turkey Product Sourcing", "stock-exchange": "Stock Exchange & Investing", "education-consultancy": "Study in Malta", "amazon-fba": "Amazon FBA",
};
const services = [];
for (const slug of Object.keys(faqs).filter((k) => k !== "_readme")) {
  const file = slug + ".html";
  let html;
  try { html = read(file); } catch { continue; }
  const name = (text(first(/<h1[^>]*>([\s\S]*?)<\/h1>/, html)) || slug).split(/:| — | – | \| /)[0].replace(/\s+from\s+[$£€].*$/i, "").trim();
  const desc = text(first(/<meta name="description" content="([^"]*)"/, html));
  const how = html.match(/<ol class="(?:fba-steps|isteps|se-steps)">([\s\S]*?)<\/ol>/);
  const howHead = how ? html.slice(Math.max(0, html.lastIndexOf("<header", how.index)), how.index) : "";
  const steps = how ? [...how[1].matchAll(/<h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p>/g)].map((m) => [text(m[1]), text(m[2])]) : [];
  const cat = priceByFile[file];
  const prices = cat ? cat.groups.flatMap((g) => g.items.map((it) => ({ sku: it.sku, name: it.name, price: it.price ?? null, currency: it.currency || cat.currency, unit: it.unit && it.unit !== "each" ? it.unit : "", note: it.note || "" }))) : [];
  const short = (CFG.services.flatMap((a) => a.items).find((it) => it[2] === "/" + slug) || [])[0];
  services.push({
    id: slug, name, short: short || name, label: LABELS[slug] || short || name, area: areaOf[slug] || "", link: "/" + slug, desc,
    howTitle: text(first(/<h2[^>]*>([\s\S]*?)<\/h2>/, howHead)), steps,
    pricing: prices.length ? "/" + slug + "#pricing" : "", prices,
    keywords: KEYWORDS[slug] || "",
    faqs: (faqs[slug].faqs || []).map(([q, a]) => [q, a]),
  });
}
for (const a of areas) {
  const cfgArea = CFG.services.find((x) => x.id === a.id);
  a.items = cfgArea ? cfgArea.items.map((it) => it[2].replace(/^\//, "")).filter((id) => services.some((s) => s.id === id)) : services.filter((s) => s.area === a.id).map((s) => s.id);
}

// General process (Services page) and the University courses.
const sv = read("services.html");
const general = [...(sv.match(/<ol class="(?:steps|isteps[^"]*)">([\s\S]*?)<\/ol>/) || ["", ""])[1].matchAll(/<h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p>/g)].map((m) => [text(m[1]), text(m[2])]);
const uni = read("university.html");
const courses = [...uni.matchAll(/<article class="uc[\s\S]*?<\/article>/g)].map((m) => {
  const a = m[0];
  return { name: text(first(/<h3[^>]*>([\s\S]*?)<\/h3>/, a)), desc: text(first(/<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/, a)), learn: [...(a.match(/<ul[^>]*class="[^"]*uc__list[^"]*"[^>]*>([\s\S]*?)<\/ul>/) || ["", ""])[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((x) => text(x[1])) };
}).filter((c) => c.name);

const consult = catalog.consultations.types.map((t) => ({ slug: t.slug, name: t.name, minutes: t.minutes, price: t.price, currency: t.currency, desc: t.desc }));

const data = {
  contact: { email: CFG.contact.email, location: CFG.contact.location, hours: "Monday–Friday, 10:00–18:00 UK time" },
  links: { book: CFG.links.book, contact: CFG.links.contact, university: CFG.links.university, assessment: "/assessment", services: "/services" },
  areas, services, general, courses, consult,
};
const out = "/* GENERATED by booking/scripts/build-assistant.mjs — do not edit by hand. */\nwindow.QA_ASSIST_DATA = " + JSON.stringify(data) + ";\n";
writeFileSync(join(SITE, "assets/js/assistant-data.js"), out);
console.log(`Assistant knowledge: ${services.length} services, ${services.reduce((n, s) => n + s.faqs.length, 0)} FAQs, ${services.reduce((n, s) => n + s.prices.length, 0)} prices, ${courses.length} courses (${Math.round(out.length / 1024)} KB).`);
