import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { BookingError } from "@/lib/booking";
import { allCatalogItems, getCatalogItem } from "@/lib/catalog";
import { createOrder, fulfillOrderPayment, priceCart, recordOrderBankPayment, startOrderCheckout } from "@/lib/orders";

const customer = { name: "Order Client", email: "Order.Client@Example.com", phone: "+447000000000", notes: "Store: example.com" };

beforeEach(async () => {
  for (const t of ["OrderPayment", "OrderItem", "Order", "Notification", "Setting"]) await prisma.$executeRawUnsafe(`DELETE FROM "${t}"`);
  await prisma.setting.create({ data: { id: 1, bankEnabled: true, bankInstructions: "Bank: Test Bank\nAccount: 12345678" } });
});
afterAll(async () => { await prisma.$disconnect(); });

describe("cart pricing", () => {
  it("prices from the catalog and only lets per-unit services have a quantity", () => {
    const p = priceCart([{ sku: "amazon-ppc", quantity: 3 }, { sku: "amazon-seo", quantity: 5 }, { sku: "amazon-products-q2", quantity: 1 }]);
    expect(p.currency).toBe("USD");
    expect(p.items.find((i) => i.sku === "amazon-ppc")).toMatchObject({ quantity: 3, unitCents: 10000, lineCents: 30000 });
    expect(p.items.find((i) => i.sku === "amazon-seo")).toMatchObject({ quantity: 1, lineCents: 25000 });
    expect(p.totalCents).toBe(30000 + 25000 + 5000);
  });

  it("merges duplicate lines", () => {
    const p = priceCart([{ sku: "dm-meta-ads", quantity: 1 }, { sku: "dm-meta-ads", quantity: 2 }]);
    expect(p.items).toHaveLength(1);
    expect(p.items[0]).toMatchObject({ quantity: 3, lineCents: 45000 });
  });

  it("rejects mixed currencies, quote-only services, unknown services and silly quantities", () => {
    expect(() => priceCart([{ sku: "tax-usa", quantity: 1 }, { sku: "tax-uk", quantity: 1 }])).toThrow(BookingError);
    expect(() => priceCart([{ sku: "etsy-seo", quantity: 1 }])).toThrow(/priced on request/);
    expect(() => priceCart([{ sku: "not-a-real-service", quantity: 1 }])).toThrow(BookingError);
    expect(() => priceCart([{ sku: "amazon-ppc", quantity: 999 }])).toThrow(/Quantity/);
    expect(() => priceCart([])).toThrow(/empty/);
  });

  it("uses each group's currency", () => {
    expect(getCatalogItem("tax-uk")?.currency).toBe("GBP");
    expect(getCatalogItem("tax-usa")?.currency).toBe("USD");
    expect(getCatalogItem("edu-malta-processing")?.currency).toBe("EUR");
    expect(getCatalogItem("tax-uk-accounting")?.multiQty).toBe(false);
  });
});

describe("orders and payment", () => {
  it("is paid exactly once even if the gateway confirms twice", async () => {
    const order = await createOrder([{ sku: "ebay-mc999", quantity: 1 }, { sku: "ebay-seo-audit", quantity: 1 }], customer);
    expect(order.clientEmail).toBe("order.client@example.com");
    expect(order.totalCents).toBe(50000);
    const { redirectUrl } = await startOrderCheckout(order, "MOCK");
    const payment = await prisma.orderPayment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(redirectUrl).toContain(`/checkout/mock-order/${payment.id}`);

    await Promise.all([fulfillOrderPayment(payment.id, { amountCents: 50000 }), fulfillOrderPayment(payment.id, { amountCents: 50000 })]);
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid.status).toBe("PAID");
    expect(paid.paidCents).toBe(50000);
    const emails = await prisma.notification.findMany({ where: { template: "order_paid" } });
    expect(emails).toHaveLength(1);
  });

  it("re-uses an open payment instead of creating duplicates", async () => {
    const order = await createOrder([{ sku: "seo-technical", quantity: 1 }], customer);
    await startOrderCheckout(order, "MOCK");
    await startOrderCheckout(order, "MOCK");
    expect(await prisma.orderPayment.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("refuses a payment for the wrong amount", async () => {
    const order = await createOrder([{ sku: "trademark-uk", quantity: 1 }], customer);
    await startOrderCheckout(order, "MOCK");
    const p = await prisma.orderPayment.findFirstOrThrow({ where: { orderId: order.id } });
    await expect(fulfillOrderPayment(p.id, { amountCents: 100 })).rejects.toThrow(/mismatch/);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("supports bank transfer, marked as received by the team", async () => {
    const order = await createOrder([{ sku: "uk-ltd-basic", quantity: 1 }], customer);
    await startOrderCheckout(order, "BANK_TRANSFER");
    expect(await prisma.notification.count({ where: { template: "bank_instructions" } })).toBe(1);
    await recordOrderBankPayment(order.id);
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid.status).toBe("PAID");
    await expect(recordOrderBankPayment(order.id)).rejects.toThrow(BookingError);
  });
});

describe("website prices match the catalog", () => {
  it("every Add to cart button on the site uses the catalog price and currency", () => {
    const site = join(__dirname, "..", "..");
    const seen = new Set<string>();
    for (const f of readdirSync(site).filter((n) => n.endsWith(".html"))) {
      const html = readFileSync(join(site, f), "utf8");
      for (const m of html.matchAll(/data-add-to-cart data-sku="([^"]+)" data-name="[^"]*" data-price="([^"]+)" data-currency="([A-Z]+)"/g)) {
        const item = getCatalogItem(m[1]);
        expect(item, `${f}: unknown SKU ${m[1]}`).toBeDefined();
        expect(Number(m[2]), `${f}: price for ${m[1]}`).toBe(item!.price);
        expect(m[3], `${f}: currency for ${m[1]}`).toBe(item!.currency);
        seen.add(m[1]);
      }
    }
    const sellable = allCatalogItems().filter((i) => i.price != null).map((i) => i.sku);
    expect(sellable.filter((s) => !seen.has(s)), "catalog services with no Add to cart button").toEqual([]);
  });
});
