import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { env, getSettings } from "@/lib/settings";
import { availableGateways } from "@/lib/payments";
import { verifyOrderStripeSession } from "@/lib/webhooks";
import { formatInTz, formatMoney } from "@/lib/util";
import { PayOrder } from "@/components/OrderClient";
import { RefreshWhilePending } from "@/components/Checkout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your Order" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { ref } = await params;
  const sp = await searchParams;
  const load = () => prisma.order.findUnique({ where: { reference: ref }, include: { items: true, payments: { orderBy: { createdAt: "asc" } } } });
  let o = await load();
  const user = await getCurrentUser();
  if (!o || !((sp.token && sp.token === o.accessToken) || isStaff(user))) notFound();

  // Returning from Stripe: verify directly in case the webhook hasn't arrived yet.
  let verifyFailed = false;
  if (sp.session_id && env.stripeConfigured() && o.status === "PENDING_PAYMENT") {
    try { if (await verifyOrderStripeSession(sp.session_id)) o = (await load())!; } catch { verifyFailed = true; }
  }

  const settings = await getSettings();
  const gateways = o.status === "PENDING_PAYMENT" ? await availableGateways() : [];
  const bankChosen = o.payments.some((p) => p.gateway === "BANK_TRANSFER" && p.status === "PENDING");
  const awaitingWebhook = o.status === "PENDING_PAYMENT" && !!sp.session_id;
  const money = (c: number) => formatMoney(c, o!.currency);

  const banner: [string, string, string] =
    o.status === "PAID" || o.status === "IN_PROGRESS" || o.status === "COMPLETED"
      ? ["bg-green-50 border-green-200 text-green-900", "Thank you — your order is confirmed", `We've received your payment and emailed a confirmation to ${o.clientEmail}. Our team will contact you within one working day.`]
      : o.status === "CANCELLED" || o.status === "REFUNDED"
        ? ["bg-slate-50 border-slate-200 text-slate-800", `This order has been ${o.status.toLowerCase()}`, "Please contact us if you have any questions."]
        : awaitingWebhook
          ? ["bg-amber-50 border-amber-200 text-amber-900", "Confirming your payment…", "This usually takes a few seconds."]
          : bankChosen
            ? ["bg-amber-50 border-amber-200 text-amber-900", "Awaiting your bank transfer", `Please transfer ${money(o.totalCents)} using reference ${o.reference}. We'll start as soon as it arrives.`]
            : ["bg-amber-50 border-amber-200 text-amber-900", sp.failed ? "Your payment didn't go through" : sp.cancelled ? "Payment cancelled" : "Awaiting payment", "Your order is saved. Choose a payment method below to complete it."];

  return (
    <div className="container-x max-w-3xl py-10">
      {awaitingWebhook && <RefreshWhilePending seconds={3} />}
      <div className={`rounded-2xl border p-5 ${banner[0]}`} role="status">
        <h1 className="font-display text-xl font-extrabold md:text-2xl">{banner[1]}</h1>
        <p className="mt-1 text-sm">{banner[2]}</p>
        {verifyFailed && <p className="mt-2 text-sm">We couldn&apos;t verify the payment just now — this page will update once it&apos;s confirmed.</p>}
      </div>

      <div className="card mt-6 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-extrabold text-ink">Order {o.reference}</h2>
          <p className="text-sm text-muted">{formatInTz(o.createdAt, settings.timezone, { dateStyle: "medium", timeStyle: "short" })}</p>
        </div>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {o.items.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="font-semibold text-ink">{i.name}{i.quantity > 1 ? ` × ${i.quantity}` : ""}</p>
                <p className="text-xs text-muted">{money(i.unitCents)}{i.unitLabel ? ` ${i.unitLabel}` : ""}{i.note ? ` · ${i.note}` : ""}</p>
              </div>
              <p className="font-semibold text-ink">{money(i.lineCents)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between text-lg font-extrabold text-ink"><span>Total</span><span>{money(o.totalCents)}</span></div>
        {o.paidCents > 0 && <p className="mt-1 text-right text-sm text-green-700">Paid {money(o.paidCents)}</p>}
      </div>

      {bankChosen && o.status === "PENDING_PAYMENT" && settings.bankInstructions.trim() && (
        <div className="card mt-6 p-6">
          <h2 className="font-display text-lg font-extrabold text-ink">Bank transfer details</h2>
          <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm">{settings.bankInstructions}</p>
          <p className="mt-3 text-sm">Payment reference: <strong>{o.reference}</strong></p>
        </div>
      )}

      {o.status === "PENDING_PAYMENT" && !awaitingWebhook && (
        <div className="card mt-6 p-6">
          <h2 className="mb-4 font-display text-lg font-extrabold text-ink">{bankChosen ? "Prefer to pay another way?" : "Complete your payment"}</h2>
          <PayOrder reference={o.reference} token={o.accessToken} gateways={gateways.filter((g) => !(bankChosen && g === "BANK_TRANSFER"))} />
        </div>
      )}

      <p className="mt-8 text-center text-sm"><a className="font-semibold text-brand underline" href={env.mainSiteUrl()}>Back to the Qalb-E-Abbas website</a></p>
    </div>
  );
}
