import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/settings";
import { formatMoney } from "@/lib/util";
import { MockOrderGateway } from "@/components/OrderClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Test Payment Gateway" };

/** DEVELOPMENT ONLY — stands in for Stripe so the order journey can be tested locally. */
export default async function MockOrderGatewayPage({ params }: { params: Promise<{ id: string }> }) {
  if (!env.mockPaymentsEnabled()) notFound();
  const { id } = await params;
  const p = await prisma.orderPayment.findUnique({ where: { id }, include: { order: { include: { items: true } } } });
  if (!p || p.gateway !== "MOCK") notFound();
  return (
    <div className="container-x max-w-xl py-14">
      <div className="card p-7">
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-900">Test mode — no real money is taken</p>
        <h1 className="mt-5 text-2xl font-extrabold">Test payment gateway</h1>
        <p className="mt-2 text-sm">Order {p.order.reference} · {p.order.items.length} service{p.order.items.length === 1 ? "" : "s"} · Payment {p.reference}</p>
        <p className="mt-6 font-display text-3xl font-extrabold text-ink">{formatMoney(p.amountCents, p.currency)}</p>
        {p.status === "PENDING" ? <div className="mt-6"><MockOrderGateway paymentId={p.id} amount={formatMoney(p.amountCents, p.currency)} /></div>
          : <p className="mt-6 text-sm">This payment is already {p.status.toLowerCase()}.</p>}
      </div>
    </div>
  );
}
