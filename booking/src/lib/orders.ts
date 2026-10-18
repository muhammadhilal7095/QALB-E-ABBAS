import type { Order, OrderItem, OrderPayment, PaymentGateway } from "@prisma/client";
import { prisma } from "./db";
import { env, getSettings } from "./settings";
import { BookingError } from "./booking";
import { availableGateways, getStripe } from "./payments";
import { getCatalogItem, MAX_QTY } from "./catalog";
import { button, detailsTable, layout, sendEmail } from "./email";
import { escapeHtml, formatMoney, makeReference, randomToken } from "./util";

export type CartLine = { sku: string; quantity: number };
export type OrderCustomer = { name: string; email: string; phone?: string | null; notes?: string | null };
type OrderFull = Order & { items: OrderItem[] };

/**
 * Prices a cart from the catalog. Prices sent by the browser are never used.
 * All items in one order must share a currency (Stripe charges one currency per payment).
 */
export function priceCart(lines: CartLine[]) {
  if (!lines.length) throw new BookingError("Your cart is empty.");
  const merged = new Map<string, number>();
  for (const l of lines) merged.set(l.sku, (merged.get(l.sku) ?? 0) + l.quantity);

  let currency: string | null = null;
  const items = [...merged.entries()].map(([sku, qty]) => {
    const item = getCatalogItem(sku);
    if (!item) throw new BookingError("One of the services in your cart is no longer available. Please refresh the page.");
    if (item.price == null) throw new BookingError(`${item.name} is priced on request — please book a consultation for a quote.`);
    const quantity = item.multiQty ? qty : 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) throw new BookingError(`Quantity for ${item.name} must be between 1 and ${MAX_QTY}.`);
    if (currency && currency !== item.currency) throw new BookingError("All services in one order must use the same currency. Please check out each currency separately.");
    currency = item.currency;
    const unitCents = Math.round(item.price * 100);
    return {
      sku, name: item.name, unitCents, quantity, lineCents: unitCents * quantity,
      unitLabel: item.unit ?? null,
      note: [item.from ? "Starting price" : null, item.note ?? null].filter(Boolean).join(" · ") || null,
    };
  });
  const totalCents = items.reduce((t, i) => t + i.lineCents, 0);
  return { currency: currency!, items, totalCents };
}

export async function createOrder(lines: CartLine[], customer: OrderCustomer): Promise<OrderFull> {
  const priced = priceCart(lines);
  return prisma.order.create({
    data: {
      reference: makeReference("ORD"), accessToken: randomToken(24),
      clientName: customer.name.trim(), clientEmail: customer.email.trim().toLowerCase(),
      clientPhone: customer.phone?.trim() || null, notes: customer.notes?.trim() || null,
      currency: priced.currency, totalCents: priced.totalCents,
      items: { create: priced.items },
    },
    include: { items: true },
  });
}

export function orderUrl(o: Pick<Order, "reference" | "accessToken">): string {
  return `${env.appUrl()}/order/${o.reference}?token=${o.accessToken}`;
}

/** Starts (or resumes) payment for an unpaid order. Returns where to send the client. */
export async function startOrderCheckout(order: OrderFull, gateway: PaymentGateway): Promise<{ redirectUrl: string }> {
  if (!(await availableGateways()).includes(gateway)) throw new BookingError("This payment method is not available.", "STATE");
  if (order.status !== "PENDING_PAYMENT") throw new BookingError("This order is not awaiting payment.", "STATE");

  // Reuse an open attempt for the same gateway so the client is never charged twice.
  const open = await prisma.orderPayment.findFirst({ where: { orderId: order.id, gateway, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  if (open && gateway === "STRIPE" && open.gatewaySessionId) {
    const session = await getStripe().checkout.sessions.retrieve(open.gatewaySessionId);
    if (session.status === "open" && session.url) return { redirectUrl: session.url };
  }
  if (open && gateway === "MOCK") return { redirectUrl: `${env.appUrl()}/checkout/mock-order/${open.id}` };
  if (open && gateway === "BANK_TRANSFER") return { redirectUrl: orderUrl(order) };

  const attempt = await prisma.orderPayment.count({ where: { orderId: order.id } });
  const payment = await prisma.orderPayment.create({
    data: {
      reference: makeReference("PAY"), orderId: order.id, gateway, amountCents: order.totalCents, currency: order.currency,
      idempotencyKey: `order:${order.id}:${attempt + 1}:${gateway}`,
    },
  });

  if (gateway === "STRIPE") {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: order.clientEmail,
      client_reference_id: order.reference,
      line_items: order.items.map((i) => ({
        quantity: i.quantity,
        price_data: {
          currency: order.currency.toLowerCase(), unit_amount: i.unitCents,
          product_data: { name: i.name, ...(i.note ? { description: i.note } : {}) },
        },
      })),
      metadata: { orderId: order.id, orderPaymentId: payment.id, reference: order.reference },
      payment_intent_data: { metadata: { orderId: order.id, orderPaymentId: payment.id, reference: order.reference } },
      success_url: `${orderUrl(order)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${orderUrl(order)}&cancelled=1`,
    }, { idempotencyKey: payment.idempotencyKey });
    await prisma.orderPayment.update({ where: { id: payment.id }, data: { gatewaySessionId: session.id } });
    return { redirectUrl: session.url! };
  }

  if (gateway === "BANK_TRANSFER") {
    await notifyOrder(order.id, "bank_instructions");
    await notifyOrder(order.id, "admin_new_order");
    return { redirectUrl: orderUrl(order) };
  }

  return { redirectUrl: `${env.appUrl()}/checkout/mock-order/${payment.id}` };
}

/** Marks an order payment successful. Idempotent: safe from webhooks, the success page and retries. */
export async function fulfillOrderPayment(paymentId: string, info: { gatewayPaymentId?: string | null; amountCents?: number | null } = {}) {
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "OrderPayment" WHERE id = ${paymentId} FOR UPDATE`;
    if (!rows.length) throw new BookingError("Payment not found.", "NOT_FOUND");
    const p = await tx.orderPayment.findUniqueOrThrow({ where: { id: paymentId } });
    if (p.status === "SUCCEEDED") return { already: true, orderId: p.orderId };
    if (info.amountCents != null && info.amountCents !== p.amountCents) {
      await tx.orderPayment.update({ where: { id: p.id }, data: { status: "FAILED", failureReason: `Amount mismatch: expected ${p.amountCents}, got ${info.amountCents}` } });
      throw new BookingError("Payment amount mismatch.", "INVALID");
    }
    const now = new Date();
    await tx.orderPayment.update({ where: { id: p.id }, data: { status: "SUCCEEDED", paidAt: now, gatewayPaymentId: info.gatewayPaymentId ?? p.gatewayPaymentId } });
    await tx.orderPayment.updateMany({ where: { orderId: p.orderId, status: "PENDING", id: { not: p.id } }, data: { status: "CANCELLED", failureReason: "Superseded by successful payment" } });
    const o = await tx.order.findUniqueOrThrow({ where: { id: p.orderId } });
    await tx.order.update({
      where: { id: o.id },
      data: { paidCents: o.paidCents + p.amountCents, ...(o.status === "PENDING_PAYMENT" ? { status: "PAID", paidAt: now } : {}) },
    });
    return { already: false, orderId: o.id };
  });
  if (!result.already) {
    await notifyOrder(result.orderId, "order_paid");
    await notifyOrder(result.orderId, "admin_new_order");
  }
  return result;
}

export async function failOrderPayment(paymentId: string, reason: string) {
  const p = await prisma.orderPayment.findUnique({ where: { id: paymentId } });
  if (!p || p.status !== "PENDING") return;
  await prisma.orderPayment.update({ where: { id: p.id }, data: { status: "FAILED", failureReason: reason.slice(0, 500) } });
}

export async function cancelOrderPayment(paymentId: string, reason: string) {
  const p = await prisma.orderPayment.findUnique({ where: { id: paymentId } });
  if (!p || p.status !== "PENDING") return;
  await prisma.orderPayment.update({ where: { id: p.id }, data: { status: "CANCELLED", failureReason: reason } });
}

/** Admin records a bank transfer as received. */
export async function recordOrderBankPayment(orderId: string) {
  const o = await prisma.order.findUnique({ where: { id: orderId } });
  if (!o) throw new BookingError("Order not found.", "NOT_FOUND");
  if (o.status !== "PENDING_PAYMENT") throw new BookingError("This order is not awaiting payment.", "STATE");
  let p: OrderPayment | null = await prisma.orderPayment.findFirst({ where: { orderId, gateway: "BANK_TRANSFER", status: "PENDING" } });
  if (!p) {
    p = await prisma.orderPayment.create({
      data: { reference: makeReference("PAY"), orderId, gateway: "BANK_TRANSFER", amountCents: o.totalCents, currency: o.currency, idempotencyKey: `order:${orderId}:manual:${Date.now()}` },
    });
  }
  return fulfillOrderPayment(p.id);
}

// ---- Emails -----------------------------------------------------------------

type OrderEmail = "order_paid" | "bank_instructions" | "admin_new_order";

function itemsTable(o: OrderFull): string {
  const rows: [string, string][] = o.items.map((i) => [
    `${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ""}${i.unitLabel ? ` (${i.unitLabel})` : ""}`,
    `${escapeHtml(formatMoney(i.lineCents, o.currency))}${i.note ? `<br><span style="font-weight:normal;color:#5F6E85;font-size:12px">${escapeHtml(i.note)}</span>` : ""}`,
  ]);
  rows.push(["Total", escapeHtml(formatMoney(o.totalCents, o.currency))]);
  return detailsTable(rows.map(([k, v]) => [escapeHtml(k), v]));
}

export async function notifyOrder(orderId: string, key: OrderEmail) {
  try {
    const o = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!o) return;
    const s = await getSettings();
    let subject: string, title: string, body: string, to = o.clientEmail;
    if (key === "order_paid") {
      subject = `Payment received — order ${o.reference}`; title = "Thank you — your order is confirmed";
      body = `<p>Hi ${escapeHtml(o.clientName)},</p><p>We've received your payment. Our team will contact you within one working day to get started.</p>${itemsTable(o)}${button("View your order", orderUrl(o))}`;
    } else if (key === "bank_instructions") {
      subject = `Bank transfer details — order ${o.reference}`; title = "Complete your order by bank transfer";
      body = `<p>Hi ${escapeHtml(o.clientName)},</p><p>Please transfer <strong>${escapeHtml(formatMoney(o.totalCents, o.currency))}</strong> using the details below and include <strong>${escapeHtml(o.reference)}</strong> as the payment reference.</p><p style="white-space:pre-line;background:#F6F8FC;border-radius:10px;padding:14px">${escapeHtml(s.bankInstructions)}</p>${itemsTable(o)}${button("View your order", orderUrl(o))}`;
    } else {
      to = s.adminNotifyEmail;
      subject = `New order ${o.reference} — ${formatMoney(o.totalCents, o.currency)} (${o.status === "PAID" ? "paid" : "awaiting bank transfer"})`;
      title = "New service order";
      body = `${detailsTable([["Client", escapeHtml(o.clientName)], ["Email", escapeHtml(o.clientEmail)], ["Phone", escapeHtml(o.clientPhone || "—")], ["Notes", escapeHtml(o.notes || "—")]])}${itemsTable(o)}${button("Open in admin", `${env.appUrl()}/admin/orders/${o.id}`)}`;
    }
    await sendEmail({ to, subject, html: layout(s, title, body), template: key });
  } catch (e) {
    console.error("notifyOrder failed", key, e);
  }
}
