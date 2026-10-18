import { handleStripeWebhook, WebhookSignatureError } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/** Stripe webhook — signature verified with STRIPE_WEBHOOK_SECRET; idempotent. */
export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const r = await handleStripeWebhook(raw, req.headers.get("stripe-signature"));
    return Response.json({ received: true, duplicate: r.duplicate });
  } catch (e) {
    if (e instanceof WebhookSignatureError) return Response.json({ error: e.message }, { status: 400 });
    console.error("Stripe webhook error", e);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 }); // Stripe will retry
  }
}
