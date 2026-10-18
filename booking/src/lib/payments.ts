import Stripe from "stripe";
import type { Booking, Payment, PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma, ACTIVE_STATUSES } from "./db";
import { env, getSettings } from "./settings";
import { addEvent, BookingError } from "./booking";
import { dateInTz, } from "./tz";
import { formatInTz, formatMoney, makeReference } from "./util";
import { notifyBooking } from "./email";

let stripeClient: Stripe | null = null;
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new BookingError("Card payments are not configured yet. Please choose another payment method or contact us.", "STATE");
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

export async function availableGateways(): Promise<PaymentGateway[]> {
  const s = await getSettings();
  const g: PaymentGateway[] = [];
  if (s.stripeEnabled && env.stripeConfigured()) g.push("STRIPE");
  if (s.bankEnabled && s.bankInstructions.trim()) g.push("BANK_TRANSFER");
  if (env.mockPaymentsEnabled()) g.push("MOCK");
  return g;
}

function paymentStatusFor(b: { paidCents: number; totalCents: number; refundedCents: number }): PaymentStatus {
  if (b.refundedCents > 0) return b.refundedCents >= b.paidCents ? "REFUNDED" : "PARTIALLY_REFUNDED";
  if (b.paidCents <= 0) return "UNPAID";
  return b.paidCents >= b.totalCents ? "PAID" : "PARTIALLY_PAID";
}

/**
 * Starts (or resumes) checkout for a held booking. Returns where to send the client.
 * Re-clicking "Pay" reuses the open payment, so the client is never charged twice.
 */
export async function startCheckout(booking: Booking, gateway: PaymentGateway): Promise<{ redirectUrl: string; payment: Payment }> {
  if (!(await availableGateways()).includes(gateway)) throw new BookingError("This payment method is not available.", "STATE");
  const now = new Date();
  if (booking.status !== "HELD" || !booking.holdExpiresAt || booking.holdExpiresAt < now) {
    throw new BookingError("This reservation has expired or is no longer awaiting payment. Please book again.", "STATE");
  }
  if (booking.dueNowCents <= 0) throw new BookingError("No payment is required for this booking.", "STATE");
  const settings = await getSettings();
  const service = await prisma.meetingService.findUniqueOrThrow({ where: { id: booking.serviceId } });

  // Reuse an open payment for the same gateway (prevents duplicate charges/sessions).
  const open = await prisma.payment.findFirst({ where: { bookingId: booking.id, gateway, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  if (open && gateway === "STRIPE" && open.gatewaySessionId) {
    const session = await getStripe().checkout.sessions.retrieve(open.gatewaySessionId);
    if (session.status === "open" && session.url) return { redirectUrl: session.url, payment: open };
  }
  if (open && gateway === "MOCK") return { redirectUrl: `${env.appUrl()}/checkout/mock/${open.id}`, payment: open };

  const attempt = await prisma.payment.count({ where: { bookingId: booking.id } });
  const payment = await prisma.payment.create({
    data: {
      reference: makeReference("PAY", now), bookingId: booking.id, gateway, amountCents: booking.dueNowCents,
      currency: booking.currency, idempotencyKey: `${booking.id}:${attempt + 1}:${gateway}`,
    },
  });
  await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: "PENDING" } });

  if (gateway === "STRIPE") {
    // Stripe requires a checkout window of at least 30 minutes; keep the hold in step with it.
    const expires = new Date(Math.max(booking.holdExpiresAt.getTime(), now.getTime() + 31 * 60_000));
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: booking.clientEmail,
      client_reference_id: booking.reference,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: booking.currency.toLowerCase(), unit_amount: booking.dueNowCents,
          product_data: {
            name: `${service.name}${booking.dueNowCents < booking.totalCents ? " (deposit)" : ""}`,
            description: `${formatInTz(booking.startAt, booking.clientTimezone, { dateStyle: "medium", timeStyle: "short" })} · Ref ${booking.reference}`,
          },
        },
      }],
      metadata: { bookingId: booking.id, paymentId: payment.id, reference: booking.reference },
      payment_intent_data: { metadata: { bookingId: booking.id, paymentId: payment.id, reference: booking.reference } },
      success_url: `${env.appUrl()}/booking/${booking.reference}?token=${booking.manageToken}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.appUrl()}/book/checkout?booking=${booking.reference}&token=${booking.manageToken}&cancelled=1`,
      expires_at: Math.floor(expires.getTime() / 1000),
    }, { idempotencyKey: payment.idempotencyKey });
    await prisma.payment.update({ where: { id: payment.id }, data: { gatewaySessionId: session.id } });
    await prisma.booking.update({ where: { id: booking.id }, data: { holdExpiresAt: expires } });
    return { redirectUrl: session.url!, payment };
  }

  if (gateway === "BANK_TRANSFER") {
    const deadline = new Date(now.getTime() + settings.bankHoldHours * 3600_000);
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "PENDING_PAYMENT", holdExpiresAt: deadline } });
    await addEvent(prisma, booking.id, "BANK_TRANSFER", "Client chose bank transfer — awaiting manual payment.");
    await notifyBooking(booking.id, "bank_instructions", { deadline: formatInTz(deadline, booking.clientTimezone, { dateStyle: "medium", timeStyle: "short" }) });
    await notifyBooking(booking.id, "admin_new_booking");
    return { redirectUrl: `${env.appUrl()}/booking/${booking.reference}?token=${booking.manageToken}`, payment };
  }

  return { redirectUrl: `${env.appUrl()}/checkout/mock/${payment.id}`, payment };
}

/**
 * Marks a payment successful and confirms the booking. Idempotent: safe to call
 * from webhooks, the success-page verification and retries.
 */
export async function fulfillPayment(paymentId: string, info: { gatewayPaymentId?: string | null; amountCents?: number | null; actorId?: string | null } = {}) {
  const settings = await getSettings();
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
    if (!rows.length) throw new BookingError("Payment not found.", "NOT_FOUND");
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status === "SUCCEEDED" || payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED") return { already: true, bookingId: payment.bookingId, confirmed: false, conflict: false };
    if (info.amountCents != null && info.amountCents !== payment.amountCents) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: `Amount mismatch: expected ${payment.amountCents}, got ${info.amountCents}` } });
      throw new BookingError("Payment amount mismatch.", "INVALID");
    }
    const now = new Date();
    await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", paidAt: now, gatewayPaymentId: info.gatewayPaymentId ?? payment.gatewayPaymentId } });
    // Any other open attempts are no longer needed.
    await tx.payment.updateMany({ where: { bookingId: payment.bookingId, status: "PENDING", id: { not: payment.id } }, data: { status: "CANCELLED", failureReason: "Superseded by successful payment" } });

    const b = await tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
    const paidCents = b.paidCents + payment.amountCents;
    const paymentStatus = paymentStatusFor({ paidCents, totalCents: b.totalCents, refundedCents: b.refundedCents });
    await addEvent(tx, b.id, "PAYMENT_SUCCEEDED", `Payment ${payment.reference} of ${formatMoney(payment.amountCents, payment.currency)} received via ${payment.gateway}.`, info.actorId);

    if (["HELD", "PENDING_PAYMENT", "EXPIRED"].includes(b.status)) {
      // If the hold already lapsed, make sure the slot is still free before re-activating it.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"booking-date:" + dateInTz(b.startAt, settings.timezone)}))`;
      const clash = await tx.booking.count({
        where: { id: { not: b.id }, status: { in: [...ACTIVE_STATUSES] }, blockStart: { lt: b.blockEnd }, blockEnd: { gt: b.blockStart } },
      });
      if (clash > 0) {
        await tx.booking.update({ where: { id: b.id }, data: { paidCents, paymentStatus, status: "EXPIRED", holdExpiresAt: null } });
        await addEvent(tx, b.id, "PAYMENT_AFTER_RELEASE", "Payment arrived after the reservation expired and the slot was taken. Reschedule or refund required.");
        return { already: false, bookingId: b.id, confirmed: false, conflict: true };
      }
      const status = settings.manualApproval ? "PENDING_APPROVAL" : "CONFIRMED";
      await tx.booking.update({
        where: { id: b.id },
        data: { paidCents, paymentStatus, status, holdExpiresAt: null, ...(status === "CONFIRMED" ? { confirmedAt: now } : {}) },
      });
      return { already: false, bookingId: b.id, confirmed: status === "CONFIRMED", conflict: false, pendingApproval: status === "PENDING_APPROVAL" };
    }
    await tx.booking.update({ where: { id: b.id }, data: { paidCents, paymentStatus } });
    return { already: false, bookingId: b.id, confirmed: false, conflict: false };
  });

  if (!result.already) {
    await notifyBooking(result.bookingId, "payment_success");
    if (result.confirmed) await notifyBooking(result.bookingId, "booking_confirmed");
    if ("pendingApproval" in result && result.pendingApproval) await notifyBooking(result.bookingId, "pending_approval");
    await notifyBooking(result.bookingId, result.conflict ? "admin_attention" : "admin_new_booking",
      result.conflict ? { reason: "Payment was received after the reservation expired and the slot was taken. Please reschedule or refund." } : {});
  }
  return result;
}

/** Payment attempt failed — the hold stays until it expires so the client can retry. */
export async function failPayment(paymentId: string, reason: string) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p || p.status !== "PENDING") return;
  await prisma.payment.update({ where: { id: p.id }, data: { status: "FAILED", failureReason: reason.slice(0, 500) } });
  const b = await prisma.booking.update({ where: { id: p.bookingId }, data: { paymentStatus: "FAILED" } });
  await addEvent(prisma, b.id, "PAYMENT_FAILED", `Payment ${p.reference} failed: ${reason}`);
  await notifyBooking(b.id, "payment_failed");
}

/** Checkout abandoned / cancelled / expired at the gateway — releases the slot if nothing was paid. */
export async function cancelPayment(paymentId: string, reason: string, releaseHold: boolean) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p || p.status !== "PENDING") return;
  await prisma.payment.update({ where: { id: p.id }, data: { status: "CANCELLED", failureReason: reason } });
  const b = await prisma.booking.findUniqueOrThrow({ where: { id: p.bookingId } });
  if (releaseHold && b.status === "HELD" && b.paidCents === 0) {
    await prisma.booking.update({ where: { id: b.id }, data: { status: "EXPIRED", paymentStatus: "CANCELLED", holdExpiresAt: null } });
    await addEvent(prisma, b.id, "EXPIRED", `Checkout ${reason.toLowerCase()} — reservation released.`);
  } else {
    await prisma.booking.update({ where: { id: b.id }, data: { paymentStatus: b.paidCents > 0 ? b.paymentStatus : "CANCELLED" } });
    await addEvent(prisma, b.id, "PAYMENT_CANCELLED", `Payment ${p.reference} cancelled: ${reason}`);
  }
}

/** Full or partial refund (Stripe refunds are executed at the gateway; others are recorded). */
export async function refundPayment(paymentId: string, amountCents: number, reason: string, actorId: string | null) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p) throw new BookingError("Payment not found.", "NOT_FOUND");
  if (!["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(p.status)) throw new BookingError("Only successful payments can be refunded.", "STATE");
  const refundable = p.amountCents - p.refundedCents;
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > refundable) throw new BookingError(`Refund must be between 0.01 and ${formatMoney(refundable, p.currency)}.`);

  let gatewayRefundId: string | null = null;
  if (p.gateway === "STRIPE") {
    if (!p.gatewayPaymentId) throw new BookingError("Missing Stripe payment reference for this payment.", "STATE");
    const r = await getStripe().refunds.create(
      { payment_intent: p.gatewayPaymentId, amount: amountCents, metadata: { paymentId: p.id } },
      { idempotencyKey: `refund:${p.id}:${p.refundedCents}:${amountCents}` },
    );
    gatewayRefundId = r.id;
  }
  await prisma.$transaction(async (tx) => {
    const refunded = p.refundedCents + amountCents;
    await tx.refund.create({ data: { paymentId: p.id, amountCents, reason, gatewayRefundId, createdById: actorId } });
    await tx.payment.update({ where: { id: p.id }, data: { refundedCents: refunded, status: refunded >= p.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    const b = await tx.booking.findUniqueOrThrow({ where: { id: p.bookingId } });
    const bRefunded = b.refundedCents + amountCents;
    await tx.booking.update({ where: { id: b.id }, data: { refundedCents: bRefunded, paymentStatus: paymentStatusFor({ paidCents: b.paidCents, totalCents: b.totalCents, refundedCents: bRefunded }) } });
    await addEvent(tx, b.id, "REFUND", `Refund of ${formatMoney(amountCents, p.currency)} processed${reason ? `: ${reason}` : ""}.`, actorId);
  });
  await notifyBooking(p.bookingId, "refund_processed", { amount: formatMoney(amountCents, p.currency) });
}

/** Admin records a bank transfer / manual payment as received. */
export async function recordManualPayment(bookingId: string, actorId: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b) throw new BookingError("Booking not found.", "NOT_FOUND");
  let p = await prisma.payment.findFirst({ where: { bookingId, gateway: "BANK_TRANSFER", status: "PENDING" } });
  if (!p) {
    const owed = b.dueNowCents - b.paidCents > 0 ? b.dueNowCents - b.paidCents : b.totalCents - b.paidCents;
    if (owed <= 0) throw new BookingError("Nothing is outstanding on this booking.", "STATE");
    p = await prisma.payment.create({ data: { reference: makeReference("PAY"), bookingId, gateway: "BANK_TRANSFER", amountCents: owed, currency: b.currency, idempotencyKey: `${bookingId}:manual:${Date.now()}` } });
  }
  return fulfillPayment(p.id, { actorId });
}
