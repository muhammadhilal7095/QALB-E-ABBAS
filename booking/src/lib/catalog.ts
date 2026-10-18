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
  return map;
}

const CATALOG = build();

export function getCatalogItem(sku: string): CatalogItem | undefined {
  return CATALOG.get(sku);
}

export function allCatalogItems(): CatalogItem[] {
  return [...CATALOG.values()];
}
