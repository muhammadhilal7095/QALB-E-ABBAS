import Stripe from "stripe";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "./env";
import { UserError } from "./http";
import { getAvailability, getCatalogItem, getConsultation, MAX_QTY, STATE_FEE_PREFIX, US_LLC_PACKAGES } from "./catalog";
import { button, detailsTable, layout, sendEmail } from "./email";
import { escapeHtml, formatMoney, makeReference } from "./util";

// ---------------------------------------------------------------------------
// What the website sends
// ---------------------------------------------------------------------------
const text = (max: number) => z.string().trim().max(max);
const customer = z.object({
  name: text(120).min(2, "Please enter your full name"),
  email: text(200).email("Please enter a valid email address"),
  phone: text(40).optional().nullable(),
  country: text(80).optional().nullable(),
});

export const bookingSchema = z.object({
  kind: z.literal("booking"),
  consultation: text(60),
  customer,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a preferred date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Please choose a preferred time"),
  timezone: text(60).optional().nullable(),
  message: text(1000).min(1, "Please tell us how we can help"),
  topic: text(60).optional().nullable(),
});

export const orderSchema = z.object({
  kind: z.literal("order"),
  items: z.array(z.object({ sku: text(80), quantity: z.number().int().min(1).max(MAX_QTY) })).min(1).max(40),
  customer,
  notes: text(1000).optional().nullable(),
});

export const submissionSchema = z.discriminatedUnion("kind", [bookingSchema, orderSchema]);
export type Submission = z.infer<typeof submissionSchema>;

export type Line = { name: string; unitCents: number; quantity: number; lineCents: number; unitLabel?: string | null; note?: string | null };
export type Priced = { currency: string; lines: Line[]; totalCents: number; title: string };

// ---------------------------------------------------------------------------
// Pricing — always from the catalog, never from the browser
// ---------------------------------------------------------------------------
export function priceSubmission(sub: Submission, opts: { checkDate?: boolean } = {}): Priced {
  if (sub.kind === "booking") {
    const c = getConsultation(sub.consultation);
    if (!c) throw new UserError("Please choose a consultation type.");
    const day = new Date(`${sub.date}T00:00:00Z`);
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    if (Number.isNaN(day.getTime()) || (opts.checkDate !== false && day < today)) throw new UserError("Please choose a preferred date from today onwards.");
    if (opts.checkDate !== false) checkAvailability(sub.date, sub.time, c.minutes);
    const cents = Math.round(c.price * 100);
    return { currency: c.currency, title: c.name, totalCents: cents, lines: [{ name: `${c.name} (${c.minutes} min)`, unitCents: cents, quantity: 1, lineCents: cents }] };
  }
  const merged = new Map<string, number>();
  for (const l of sub.items) merged.set(l.sku, (merged.get(l.sku) ?? 0) + l.quantity);

  // A US LLC package must be paid together with exactly one state's filing fee (and vice versa).
  const skus = [...merged.keys()];
  const packages = skus.filter((s) => US_LLC_PACKAGES.has(s));
  const stateFees = skus.filter((s) => s.startsWith(STATE_FEE_PREFIX));
  if (packages.length > 1) throw new UserError("Please choose one US LLC package per order (Basic or Advanced).");
  if (packages.length === 1 && stateFees.length === 0) throw new UserError("Please choose the state for your US LLC on the US LLC page, so we can add its filing fee.");
  if (stateFees.length > 1) throw new UserError("Please choose only one state for your US LLC.");
  if (stateFees.length === 1 && packages.length === 0) throw new UserError("The state filing fee must be paid together with a US LLC package (Basic or Advanced).");
  let currency: string | null = null;
  const lines = [...merged.entries()].map(([sku, qty]) => {
    const item = getCatalogItem(sku);
    if (!item) throw new UserError("One of the services in your cart is no longer available. Please refresh the page.");
    if (item.price == null) throw new UserError(`${item.name} is priced on request — please book a consultation for a quote.`);
    const quantity = item.multiQty ? qty : 1;
    if (quantity < 1 || quantity > MAX_QTY) throw new UserError(`Quantity for ${item.name} must be between 1 and ${MAX_QTY}.`);
    if (currency && currency !== item.currency) throw new UserError("All services in one payment must use the same currency. Please check out each currency separately.");
    currency = item.currency;
    const unitCents = Math.round(item.price * 100);
    return {
      name: item.name, unitCents, quantity, lineCents: unitCents * quantity, unitLabel: item.unit ?? null,
      note: [item.from ? "Starting price" : null, item.note ?? null].filter(Boolean).join(" · ") || null,
    };
  });
  return { currency: currency!, lines, totalCents: lines.reduce((t, l) => t + l.lineCents, 0), title: lines.length === 1 ? lines[0].name : `${lines.length} services` };
}


// ---------------------------------------------------------------------------
// Booking hours (catalog.availability): day of week, time window and notice.
// ---------------------------------------------------------------------------
function zonedToUtc(date: string, time: string, zone: string): Date {
  const [y, mo, d] = date.split("-").map(Number), [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  return new Date(guess - (asUtc - guess));
}
export function checkAvailability(date: string, time: string, minutes: number, now = new Date()) {
  const a = getAvailability();
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
  if (!a.days.includes(wd)) throw new UserError("We're not available on that day. Please choose another date.");
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const t = toMin(time);
  if (t < toMin(a.start) || t + minutes > toMin(a.end) || (t - toMin(a.start)) % a.slotMinutes !== 0) throw new UserError(`Please choose a time between ${a.start} and ${a.end} UK time.`);
  if (zonedToUtc(date, time, a.timezone).getTime() < now.getTime() + a.minNoticeHours * 3600_000) throw new UserError(`Please choose a time at least ${a.minNoticeHours} hours from now.`);
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------
export type Gateway = "STRIPE" | "TEST";
export function availableGateways(): Gateway[] {
  if (env.stripeConfigured()) return ["STRIPE"];
  if (env.testPaymentsEnabled()) return ["TEST"];
  return [];
}

let stripeClient: Stripe | null = null;
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new UserError("Card payments are not set up yet. Please contact us to book.", 503);
  return (stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY));
}

// The form details travel with the payment as Stripe metadata (max 500 characters per value).
function split(s: string | null | undefined, n: number) {
  const v = (s || "").slice(0, n * 490);
  const out: Record<string, string> = {};
  for (let i = 0; i < n; i++) { const part = v.slice(i * 490, (i + 1) * 490); if (part) out[`${i}`] = part; }
  return out;
}
export function toMetadata(ref: string, sub: Submission): Record<string, string> {
  const m: Record<string, string> = { ref, kind: sub.kind, name: sub.customer.name, email: sub.customer.email };
  if (sub.customer.phone) m.phone = sub.customer.phone;
  if (sub.customer.country) m.country = sub.customer.country;
  const long = (key: string, v?: string | null) => { for (const [i, part] of Object.entries(split(v, 3))) m[`${key}${i}`] = part; };
  if (sub.kind === "booking") {
    m.consultation = sub.consultation; m.date = sub.date; m.time = sub.time;
    if (sub.timezone) m.tz = sub.timezone;
    if (sub.topic) m.topic = sub.topic;
    long("msg", sub.message);
  } else {
    m.items = sub.items.map((i) => `${i.sku}*${i.quantity}`).join(",").slice(0, 500);
    long("notes", sub.notes);
  }
  return m;
}
export function fromMetadata(m: Record<string, string>): { ref: string; sub: Submission } {
  const joined = (key: string) => [0, 1, 2].map((i) => m[`${key}${i}`] || "").join("");
  const c = { name: m.name, email: m.email, phone: m.phone || null, country: m.country || null };
  const sub: Submission = m.kind === "booking"
    ? { kind: "booking", consultation: m.consultation, customer: c, date: m.date, time: m.time, timezone: m.tz || null, message: joined("msg"), topic: m.topic || null }
    : { kind: "order", customer: c, notes: joined("notes") || null, items: (m.items || "").split(",").filter(Boolean).map((p) => { const [sku, q] = p.split("*"); return { sku, quantity: Number(q) || 1 }; }) };
  return { ref: m.ref, sub };
}

// Test checkout (development only): the data is signed so it can't be altered in between.
export function signPayload(data: unknown): string {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = createHmac("sha256", env.testSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
export function readPayload<T>(token: string): T {
  const [body, sig] = token.split(".");
  const expected = createHmac("sha256", env.testSecret()).update(body || "").digest("base64url");
  if (!body || !sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new UserError("This test payment link is invalid or has expired.", 400);
  return JSON.parse(Buffer.from(body, "base64url").toString());
}

/** Validates, prices and starts payment. Returns where to send the client. */
export async function startPayment(sub: Submission, gateway: Gateway): Promise<{ redirectUrl: string; reference: string }> {
  if (!availableGateways().includes(gateway)) throw new UserError("Online payment is not available right now. Please contact us.", 503);
  const priced = priceSubmission(sub);
  const ref = makeReference(sub.kind === "booking" ? "BK" : "ORD");
  const site = env.mainSiteUrl();

  if (gateway === "TEST") {
    return { reference: ref, redirectUrl: `${env.appUrl()}/checkout/test?p=${signPayload({ ref, sub })}` };
  }

  const metadata = toMetadata(ref, sub);
  const cancel = sub.kind === "booking"
    ? `${site}/book-consultation?cancelled=1${sub.topic ? `&topic=${encodeURIComponent(sub.topic)}` : ""}`
    : `${site}/cart?cancelled=1`;
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: sub.customer.email,
    client_reference_id: ref,
    line_items: priced.lines.map((l) => ({
      quantity: l.quantity,
      price_data: { currency: priced.currency.toLowerCase(), unit_amount: l.unitCents, product_data: { name: l.name, ...(l.note ? { description: l.note } : {}) } },
    })),
    metadata,
    payment_intent_data: { metadata: { ref }, receipt_email: sub.customer.email },
    success_url: `${env.appUrl()}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancel,
  });
  return { reference: ref, redirectUrl: session.url! };
}

// ---------------------------------------------------------------------------
// After payment: email the details. Safe to call more than once per payment.
// ---------------------------------------------------------------------------
export type Paid = { ref: string; sub: Submission; priced: Priced; paidCents: number; paymentId: string };

/** Reads a Stripe Checkout session; returns null if it isn't paid. */
export async function paidFromSession(sessionId: string): Promise<Paid | null> {
  const s = await stripe().checkout.sessions.retrieve(sessionId);
  if (s.payment_status !== "paid" || !s.metadata?.ref) return null;
  return paidFromStripeSession(s);
}
export function paidFromStripeSession(s: Stripe.Checkout.Session): Paid {
  const { ref, sub } = fromMetadata(s.metadata as Record<string, string>);
  const priced = priceSubmission(sub, { checkDate: false });
  const paymentId = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id || s.id;
  return { ref, sub, priced, paidCents: s.amount_total ?? priced.totalCents, paymentId };
}

function rowsFor(p: Paid): [string, string][] {
  const { sub, priced } = p;
  const money = (c: number) => escapeHtml(formatMoney(c, priced.currency));
  const rows: [string, string][] = [["Reference", escapeHtml(p.ref)]];
  if (sub.kind === "booking") {
    rows.push(["Consultation", escapeHtml(priced.lines[0].name)]);
    const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${sub.date}T00:00:00Z`));
    rows.push(["Preferred date", escapeHtml(when)]);
    rows.push(["Preferred time", escapeHtml(`${sub.time}${sub.timezone ? ` (${sub.timezone})` : ""}`)]);
  } else {
    for (const l of priced.lines) {
      rows.push([`${l.name}${l.quantity > 1 ? ` × ${l.quantity}` : ""}`, `${money(l.lineCents)}${l.note ? `<br><span style="font-weight:normal;color:#5F6E85;font-size:12px">${escapeHtml(l.note)}</span>` : ""}`]);
    }
  }
  rows.push(["Amount paid", money(p.paidCents)]);
  return rows;
}

function customerRows(p: Paid): [string, string][] {
  const c = p.sub.customer;
  const msg = p.sub.kind === "booking" ? p.sub.message : p.sub.notes;
  return [
    ["Name", escapeHtml(c.name)],
    ["Email", `<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>`],
    ["Phone / WhatsApp", escapeHtml(c.phone || "—")],
    ["Country", escapeHtml(c.country || "—")],
    [p.sub.kind === "booking" ? "Message" : "Notes", `<span style="white-space:pre-line;font-weight:normal">${escapeHtml(msg || "—")}</span>`],
  ];
}

export async function sendPaidEmails(p: Paid) {
  const isBooking = p.sub.kind === "booking";
  const name = p.sub.customer.name;
  const amount = formatMoney(p.paidCents, p.priced.currency);

  // To you
  const adminSubject = isBooking
    ? `New paid booking: ${p.priced.title} — ${name} (${amount})`
    : `New paid order: ${p.priced.title} — ${name} (${amount})`;
  const adminBody = `<p>A payment was completed on the website. Reply to this email to contact the client directly.</p>
${detailsTable(rowsFor(p))}<p style="margin:18px 0 6px;font-weight:bold;color:#0B1B36">Client details</p>${detailsTable(customerRows(p))}
<p style="font-size:12px;color:#5F6E85">Payment ID: ${escapeHtml(p.paymentId)}</p>`;
  await sendEmail({ to: env.adminEmail(), subject: adminSubject, html: layout(isBooking ? "New paid consultation booking" : "New paid service order", adminBody), key: `${p.ref}-admin`, replyTo: p.sub.customer.email });

  // To the client
  const clientBody = `<p>Hi ${escapeHtml(name.split(" ")[0])},</p>
<p>Thank you — we've received your payment of <strong>${escapeHtml(amount)}</strong>. ${isBooking
    ? "Our team will contact you within one working day to confirm your consultation time and send the meeting link."
    : "Our team will contact you within one working day to get started."}</p>
${detailsTable(rowsFor(p))}
<p>Questions? Just reply to this email.</p>${button("Visit our website", env.mainSiteUrl())}`;
  await sendEmail({ to: p.sub.customer.email, subject: `Payment received — ${p.priced.title} (${p.ref})`, html: layout(isBooking ? "Your booking is received" : "Your order is confirmed", clientBody), key: `${p.ref}-client`, replyTo: env.adminEmail() });
}
