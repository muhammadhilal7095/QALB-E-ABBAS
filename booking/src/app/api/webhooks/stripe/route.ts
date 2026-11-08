import Stripe from "stripe";
import { paidFromStripeSession, sendPaidEmails } from "@/lib/checkout";

/**
 * Stripe webhook — the reliable trigger for the "payment received" emails.
 * Dashboard → Developers → Webhooks → endpoint {APP_URL}/api/webhooks/stripe,
 * events: checkout.session.completed and checkout.session.async_payment_succeeded.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return new Response("Webhook not configured", { status: 503 });
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") || "", secret);
  } catch (e) {
    return new Response(`Invalid signature: ${e instanceof Error ? e.message : ""}`, { status: 400 });
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.payment_status === "paid" && s.metadata?.ref) {
      try {
        await sendPaidEmails(paidFromStripeSession(s));
      } catch (e) {
        console.error("Sending paid emails failed", e);
        return new Response("Email failed — Stripe will retry", { status: 500 });
      }
    }
  }
  return new Response("ok");
}
