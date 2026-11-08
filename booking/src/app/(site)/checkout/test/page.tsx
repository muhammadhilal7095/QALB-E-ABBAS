import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { priceSubmission, readPayload, type Submission } from "@/lib/checkout";
import { formatMoney } from "@/lib/util";
import { TestGateway } from "@/components/TestGateway";

export const dynamic = "force-dynamic";
export const metadata = { title: "Test payment" };

/** DEVELOPMENT ONLY — stands in for Stripe when no Stripe key is set. */
export default async function TestCheckout({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!env.testPaymentsEnabled()) notFound();
  const sp = await searchParams;
  let data: { ref: string; sub: Submission };
  try { data = readPayload(sp.p || ""); } catch { notFound(); }
  const priced = priceSubmission(data.sub, { checkDate: false });
  const amount = formatMoney(priced.totalCents, priced.currency);
  return (
    <div className="container-x max-w-xl py-14">
      <div className="card p-7">
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-900">Test mode — no real money is taken</p>
        <h1 className="mt-5 text-2xl font-extrabold">Test payment</h1>
        <ul className="mt-3 space-y-1 text-sm">
          {priced.lines.map((l) => <li key={l.name}>{l.name}{l.quantity > 1 ? ` × ${l.quantity}` : ""} — {formatMoney(l.lineCents, priced.currency)}</li>)}
        </ul>
        <p className="mt-6 font-display text-3xl font-extrabold text-ink">{amount}</p>
        <p className="mt-1 text-xs text-muted">Add a Stripe key to take real card payments. This page is never shown in production.</p>
        <div className="mt-6"><TestGateway p={sp.p!} amount={amount} /></div>
      </div>
    </div>
  );
}
