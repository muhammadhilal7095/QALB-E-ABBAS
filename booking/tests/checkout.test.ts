import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { allCatalogItems, allConsultations, getCatalogItem, getConsultation } from "@/lib/catalog";
import { checkAvailability, fromMetadata, priceSubmission, readPayload, sendPaidEmails, signPayload, startPayment, toMetadata, type Submission } from "@/lib/checkout";

// Next weekday at least 3 days ahead (bookings are Mon–Fri only).
const future = (() => { const d = new Date(Date.now() + 3 * 86400_000); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
const saturday = (() => { const d = new Date(Date.now() + 3 * 86400_000); while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
const customer = { name: "Test Client", email: "client@example.com", phone: "+447000000000", country: "Pakistan" };
const booking: Submission = { kind: "booking", consultation: "ecommerce", customer, date: future, time: "14:30", timezone: "Asia/Karachi", message: "I want to start on Amazon.\nWhere do I begin?", topic: "amazon" };
const order: Submission = { kind: "order", customer, notes: "Store: example.com", items: [{ sku: "amazon-ppc", quantity: 3 }, { sku: "amazon-seo", quantity: 5 }, { sku: "amazon-products-q1", quantity: 1 }] };

describe("pricing (always from the catalog)", () => {
  it("prices a consultation booking", () => {
    const p = priceSubmission(booking);
    expect(p).toMatchObject({ currency: "USD", totalCents: 5000 });
    expect(p.lines[0].name).toContain("E-commerce Consultation");
  });
  it("rejects a past date or unknown consultation", () => {
    expect(() => priceSubmission({ ...booking, date: "2020-01-01" } as Submission)).toThrow(/date/);
    expect(() => priceSubmission({ ...booking, consultation: "nope" } as Submission)).toThrow();
    expect(() => priceSubmission({ ...booking, date: "2020-01-01" } as Submission, { checkDate: false })).not.toThrow();
  });
  it("prices a cart; only per-unit services keep a quantity", () => {
    expect(priceSubmission(order).totalCents).toBe(30000 + 25000 + 5000);
  });
  it("rejects mixed currencies and unknown services", () => {
    expect(() => priceSubmission({ ...order, items: [{ sku: "tax-usa", quantity: 1 }, { sku: "tax-uk", quantity: 1 }] } as Submission)).toThrow(/currency/);
    expect(() => priceSubmission({ ...order, items: [{ sku: "fake", quantity: 1 }] } as Submission)).toThrow();
  });
});

describe("US LLC packages + state filing fee", () => {
  const llc = (items: { sku: string; quantity: number }[]) => ({ ...order, items }) as Submission;
  it("has a fee item for all 50 states plus DC", () => {
    expect(allCatalogItems().filter((i) => i.sku.startsWith("us-state-fee-"))).toHaveLength(51);
    expect(getCatalogItem("us-state-fee-wy")).toMatchObject({ price: 100, currency: "USD" });
  });
  it("prices a package plus the chosen state's fee", () => {
    const p = priceSubmission(llc([{ sku: "us-llc-basic", quantity: 1 }, { sku: "us-state-fee-tx", quantity: 1 }]));
    expect(p.totalCents).toBe(55000 + 30000);
    expect(p.lines.map((l) => l.name)).toContain("US LLC state filing fee — Texas");
  });
  it("requires exactly one state with a package, and a package with a state", () => {
    expect(() => priceSubmission(llc([{ sku: "us-llc-advanced", quantity: 1 }]))).toThrow(/choose the state/);
    expect(() => priceSubmission(llc([{ sku: "us-state-fee-wy", quantity: 1 }]))).toThrow(/together with a US LLC package/);
    expect(() => priceSubmission(llc([{ sku: "us-llc-basic", quantity: 1 }, { sku: "us-state-fee-wy", quantity: 1 }, { sku: "us-state-fee-de", quantity: 1 }]))).toThrow(/only one state/);
    expect(() => priceSubmission(llc([{ sku: "us-llc-basic", quantity: 1 }, { sku: "us-llc-advanced", quantity: 1 }, { sku: "us-state-fee-wy", quantity: 1 }]))).toThrow(/one US LLC package/);
  });
});

describe("booking hours", () => {
  it("accepts a weekday time inside the hours", () => {
    expect(() => checkAvailability(future, "14:00", 60)).not.toThrow();
  });
  it("rejects weekends, times outside the hours and short notice", () => {
    expect(() => checkAvailability(saturday, "14:00", 30)).toThrow(/not available/);
    expect(() => checkAvailability(future, "08:00", 30)).toThrow(/between/);
    expect(() => checkAvailability(future, "17:30", 60)).toThrow(/between/);
    expect(() => checkAvailability(future, "10:15", 30)).toThrow(/between/);
    expect(() => checkAvailability(future, "10:00", 30, new Date(`${future}T08:00:00Z`))).toThrow(/hours from now/);
  });
});

describe("form details travel with the payment", () => {
  it("round-trips booking and order details through Stripe metadata", () => {
    const long = { ...booking, message: "x".repeat(1000) } as Submission;
    for (const sub of [long, order]) {
      const m = toMetadata("REF-1", sub);
      for (const v of Object.values(m)) expect(v.length).toBeLessThanOrEqual(500);
      expect(Object.keys(m).length).toBeLessThanOrEqual(50);
      expect(fromMetadata(m)).toEqual({ ref: "REF-1", sub });
    }
  });
  it("test-payment links are signed and can't be altered", () => {
    const t = signPayload({ ref: "A", sub: booking });
    expect(readPayload<{ ref: string }>(t).ref).toBe("A");
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ref: "A", sub: { ...booking, consultation: "seo" } })).toString("base64url");
    expect(() => readPayload(`${forged}.${sig}`)).toThrow();
    expect(() => readPayload(`${body}.bad`)).toThrow();
  });
});

describe("payment and emails", () => {
  const dir = join(process.cwd(), ".emails");
  beforeEach(() => { if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.startsWith("TEST-")) rmSync(join(dir, f)); });

  it("starts a test payment when no Stripe key is set", async () => {
    const r = await startPayment(booking, "TEST");
    expect(r.redirectUrl).toContain("/checkout/test?p=");
    expect(r.reference).toMatch(/^BK-/);
  });

  it("emails the team and the client once per payment, with the form details", async () => {
    const priced = priceSubmission(order);
    const paid = { ref: "TEST-ORD-1", sub: order, priced, paidCents: priced.totalCents, paymentId: "pi_test" };
    await sendPaidEmails(paid);
    await sendPaidEmails(paid); // webhook + thank-you page: still only one email each
    const files = readdirSync(dir).filter((f) => f.startsWith("TEST-ORD-1"));
    expect(files.sort()).toEqual(["TEST-ORD-1-admin.html", "TEST-ORD-1-client.html"]);
    const admin = readFileSync(join(dir, "TEST-ORD-1-admin.html"), "utf8");
    expect(admin).toContain("Store: example.com");
    expect(admin).toContain("+447000000000");
    expect(admin).toContain("Amazon PPC × 3");
  });
});

describe("website matches the catalog", () => {
  const site = join(__dirname, "..", "..");
  it("every Add to cart button uses the catalog price and currency", () => {
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
    // State filing fees are added by the US LLC state selector, not by their own buttons.
    expect(allCatalogItems().filter((i) => i.price != null && !seen.has(i.sku) && !i.sku.startsWith("us-state-fee-")).map((i) => i.sku)).toEqual([]);
  });
  it("the US LLC state selector shows every state at the catalog fee", () => {
    const html = readFileSync(join(site, "us-llc-formation.html"), "utf8");
    const json = html.match(/<script type="application\/json" id="us-state-fees">([\s\S]*?)<\/script>/);
    expect(json).toBeTruthy();
    const states = JSON.parse(json![1]) as { code: string; fee: number }[];
    expect(states).toHaveLength(51);
    for (const s of states) expect(getCatalogItem(`us-state-fee-${s.code.toLowerCase()}`)?.price, s.code).toBe(s.fee);
  });
  it("the booking form lists every consultation at the catalog price", () => {
    const html = readFileSync(join(site, "book-consultation.html"), "utf8");
    const opts = [...html.matchAll(/<option value="([^"]+)" data-price="([^"]+)" data-currency="([A-Z]+)"/g)];
    expect(opts.map((o) => o[1]).sort()).toEqual(allConsultations().map((c) => c.slug).sort());
    for (const o of opts) expect([Number(o[2]), o[3]]).toEqual([getConsultation(o[1])!.price, getConsultation(o[1])!.currency]);
  });
});
