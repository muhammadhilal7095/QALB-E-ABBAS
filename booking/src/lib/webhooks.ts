import Stripe from "stripe";
import { prisma } from "./db";
import { cancelPayment, failPayment, fulfillPayment, getStripe } from "./payments";
import { cancelOrderPayment, failOrderPayment, fulfillOrderPayment } from "./orders";

export class WebhookSignatureError extends Error {}

/** Verifies the Stripe signature and processes the event exactly once. */
export async function handleStripeWebhook(rawBody: string, signature: string | null, secret = process.env.STRIPE_WEBHOOK_SECRET) {
  if (!secret) throw new WebhookSignatureError("STRIPE_WEBHOOK_SECRET is not configured.");
  if (!signature) throw new WebhookSignatureError("Missing Stripe-Signature header.");
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    throw new WebhookSignatureError(e instanceof Error ? e.message : "Invalid signature");
  }

  if (await prisma.webhookEvent.findUnique({ where: { id: event.id } })) return { duplicate: true, type: event.type };

  // Handlers are idempotent themselves, so a retry after a crash is safe.
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object as Stripe.Checkout.Session;
      const paymentId = s.metadata?.paymentId;
      const piId = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
      if (paymentId && s.payment_status === "paid") {
        await fulfillPayment(paymentId, { gatewayPaymentId: piId, amountCents: s.amount_total });
      }
      if (s.metadata?.orderPaymentId && s.payment_status === "paid") {
        await fulfillOrderPayment(s.metadata.orderPaymentId, { gatewayPaymentId: piId, amountCents: s.amount_total });
      }
      break;
    }
    case "checkout.session.async_payment_failed": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.metadata?.paymentId) await failPayment(s.metadata.paymentId, "Payment was declined by the bank.");
      if (s.metadata?.orderPaymentId) await failOrderPayment(s.metadata.orderPaymentId, "Payment was declined by the bank.");
      break;
    }
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.metadata?.paymentId) await cancelPayment(s.metadata.paymentId, "Expired", true);
      if (s.metadata?.orderPaymentId) await cancelOrderPayment(s.metadata.orderPaymentId, "Expired");
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.paymentId) await failPayment(pi.metadata.paymentId, pi.last_payment_error?.message || "Card declined.");
      if (pi.metadata?.orderPaymentId) await failOrderPayment(pi.metadata.orderPaymentId, pi.last_payment_error?.message || "Card declined.");
      break;
    }
    default:
      break;
  }
  await prisma.webhookEvent.create({ data: { id: event.id, gateway: "STRIPE", type: event.type } }).catch(() => undefined);
  return { duplicate: false, type: event.type };
}

/** Fallback used by the success page: asks Stripe directly whether the session is paid. */
export async function verifyStripeSession(sessionId: string) {
  const s = await getStripe().checkout.sessions.retrieve(sessionId);
  const paymentId = s.metadata?.paymentId;
  if (paymentId && s.payment_status === "paid") {
    await fulfillPayment(paymentId, { gatewayPaymentId: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id, amountCents: s.amount_total });
    return true;
  }
  return false;
}

/** Success-page fallback for orders: asks Stripe directly whether the session is paid. */
export async function verifyOrderStripeSession(sessionId: string) {
  const s = await getStripe().checkout.sessions.retrieve(sessionId);
  const id = s.metadata?.orderPaymentId;
  if (id && s.payment_status === "paid") {
    await fulfillOrderPayment(id, { gatewayPaymentId: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id, amountCents: s.amount_total });
    return true;
  }
  return false;
}
