import raw from "./service-catalog.json";

/** One purchasable (or quote-only) service from service-catalog.json. */
export type CatalogItem = {
  sku: string;
  name: string;
  /** Whole currency units; null = price on request (cannot be bought online). */
  price: number | null;
  currency: string;
  unit?: string;
  note?: string;
  desc?: string;
  /** "From" price — charged as the starting price, final scope confirmed afterwards. */
  from?: boolean;
  /** Quantity can be changed in the cart (per product / per month). */
  multiQty: boolean;
  page: string;
};

type RawItem = { sku: string; name: string; price: number | null; unit?: string; note?: string; desc?: string; from?: boolean; fixedQty?: boolean };
type RawGroup = { title: string; currency?: string; items: RawItem[] };
type RawPage = { currency?: string; groups: RawGroup[]; quarters?: { skuPrefix: string; label: string; price: number } };

export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

// ---- US LLC state filing fees ------------------------------------------------------
export type UsState = { code: string; name: string; fee: number; note?: string };
export const US_STATE_FEES = (raw as unknown as { usStateFees: { packages: string[]; states: UsState[] } }).usStateFees;
export const STATE_FEE_PREFIX = "us-state-fee-";
export const stateFeeSku = (code: string) => `${STATE_FEE_PREFIX}${code.toLowerCase()}`;
/** SKUs that are US LLC packages (each needs exactly one state fee in the same order). */
export const US_LLC_PACKAGES = new Set(US_STATE_FEES.packages);
export const MAX_QTY = 50;

function build(): Map<string, CatalogItem> {
  const map = new Map<string, CatalogItem>();
  const add = (item: CatalogItem) => {
    if (map.has(item.sku)) throw new Error(`Duplicate SKU in service-catalog.json: ${item.sku}`);
    map.set(item.sku, item);
  };
  for (const [page, p] of Object.entries((raw as unknown as { pages: Record<string, RawPage> }).pages)) {
    for (const g of p.groups) {
      const currency = g.currency || p.currency;
      if (!currency) throw new Error(`No currency for ${page} / ${g.title}`);
      for (const i of g.items) {
        add({
          sku: i.sku, name: i.name, price: i.price, currency, unit: i.unit, note: i.note, desc: i.desc, from: i.from,
          multiQty: !!i.unit && !i.fixedQty, page,
        });
      }
    }
    if (p.quarters) {
      for (const q of QUARTERS) {
        add({
          sku: `${p.quarters.skuPrefix}-${q.toLowerCase()}`, name: `${p.quarters.label} — ${q} (20 products)`,
          price: p.quarters.price, currency: p.currency!, multiQty: false, page,
        });
      }
    }
  }
  // US LLC state filing fees: one item per state ("us-state-fee-tx"), added alongside a US LLC package.
  for (const s of US_STATE_FEES.states) {
    add({
      sku: stateFeeSku(s.code), name: `US LLC state filing fee — ${s.name}`, price: s.fee, currency: "USD",
      note: s.note, multiQty: false, page: "us-llc",
    });
  }
  return map;
}

const CATALOG = build();

export function getCatalogItem(sku: string): CatalogItem | undefined {
  return CATALOG.get(sku);
}

export function allCatalogItems(): CatalogItem[] {
  return [...CATALOG.values()];
}

// ---- Paid consultations (Book a Consultation form) --------------------------------

export type Consultation = { slug: string; name: string; minutes: number; price: number; currency: string; desc: string; topics: string[] };

const CONSULTATIONS: Consultation[] = (raw as unknown as { consultations: { types: Consultation[] } }).consultations.types;

export function getConsultation(slug: string): Consultation | undefined {
  return CONSULTATIONS.find((c) => c.slug === slug);
}

export function allConsultations(): Consultation[] {
  return CONSULTATIONS;
}

// ---- Booking hours ---------------------------------------------------------------

export type Availability = { timezone: string; days: number[]; start: string; end: string; slotMinutes: number; minNoticeHours: number };

export function getAvailability(): Availability {
  return (raw as unknown as { availability: Availability }).availability;
}
