import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatInTz, formatMoney } from "@/lib/util";
import { orderUrl } from "@/lib/orders";
import { PageTitle } from "@/components/AdminBits";
import { StatusBadge } from "@/components/SiteChrome";
import { ApiButton } from "@/components/AdminUI";

export const metadata = { title: "Order" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage();
  const { id } = await params;
  const o = await prisma.order.findUnique({ where: { id }, include: { items: true, payments: { orderBy: { createdAt: "asc" } } } });
  if (!o) notFound();
  const s = await getSettings();
  const money = (c: number) => formatMoney(c, o.currency);
  const url = `/api/admin/orders/${o.id}`;
  const open = !["CANCELLED", "REFUNDED"].includes(o.status);
  return (
    <>
      <PageTitle title={`Order ${o.reference}`} sub={formatInTz(o.createdAt, s.timezone, { dateStyle: "full", timeStyle: "short" })}>
        <Link className="btn-ghost btn-sm" href="/admin/orders">All orders</Link>
      </PageTitle>
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">Services</h2><StatusBadge status={o.status} /></div>
          <table className="table-x mt-3">
            <thead><tr><th>Service</th><th>Unit</th><th>Qty</th><th className="text-right">Line</th></tr></thead>
            <tbody>
              {o.items.map((i) => (
                <tr key={i.id}><td>{i.name}{i.note && <span className="block text-xs text-muted">{i.note}</span>}</td><td>{money(i.unitCents)}{i.unitLabel ? ` ${i.unitLabel}` : ""}</td><td>{i.quantity}</td><td className="text-right font-semibold">{money(i.lineCents)}</td></tr>
              ))}
              <tr><td colSpan={3} className="font-extrabold">Total</td><td className="text-right font-extrabold">{money(o.totalCents)}</td></tr>
            </tbody>
          </table>
          <h3 className="mb-2 mt-6 font-extrabold">Payments</h3>
          <ul className="space-y-1 text-sm">
            {o.payments.map((p) => <li key={p.id} className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">{p.reference}</span><span>{p.gateway}</span><StatusBadge status={p.status} /><span>{money(p.amountCents)}</span>{p.failureReason && <span className="text-xs text-muted">{p.failureReason}</span>}</li>)}
            {!o.payments.length && <li className="text-muted">No payment attempts yet.</li>}
          </ul>
        </div>
        <div className="space-y-5">
          <div className="card p-5 text-sm">
            <h2 className="mb-2 text-lg font-extrabold">Client</h2>
            <p className="font-semibold">{o.clientName}</p>
            <p><a className="text-brand" href={`mailto:${o.clientEmail}`}>{o.clientEmail}</a></p>
            {o.clientPhone && <p><a className="text-brand" href={`tel:${o.clientPhone}`}>{o.clientPhone}</a></p>}
            {o.notes && <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 p-3">{o.notes}</p>}
            <p className="mt-3"><a className="text-xs font-semibold text-brand" href={orderUrl(o)} target="_blank" rel="noreferrer">Client order page ↗</a></p>
          </div>
          {open && (
            <div className="card flex flex-wrap gap-2 p-5">
              {o.status === "PENDING_PAYMENT" && <ApiButton url={url} method="POST" body={{ action: "markPaid" }} label="Mark bank transfer received" className="btn-primary btn-sm" confirm="Confirm the full payment has arrived in your bank account?" />}
              {o.status === "PAID" && <ApiButton url={url} method="POST" body={{ action: "status", status: "IN_PROGRESS" }} label="Start work" className="btn-primary btn-sm" />}
              {(o.status === "PAID" || o.status === "IN_PROGRESS") && <ApiButton url={url} method="POST" body={{ action: "status", status: "COMPLETED" }} label="Mark completed" />}
              <ApiButton url={url} method="POST" body={{ action: "status", status: "CANCELLED" }} label="Cancel order" className="btn-danger btn-sm" confirm={o.paidCents > 0 ? "This order has been paid. Cancel it? Refund the client from your Stripe dashboard or bank." : "Cancel this order?"} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
