import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatInTz, formatMoney } from "@/lib/util";
import { PageTitle } from "@/components/AdminBits";
import { StatusBadge } from "@/components/SiteChrome";
import { RefundForm } from "@/components/AdminUI";

export const metadata = { title: "Payments & Refunds" };

export default async function Payments({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireStaffPage();
  const sp = await searchParams;
  const s = await getSettings();
  const where: Prisma.PaymentWhereInput = {};
  if (sp.status) where.status = sp.status as Prisma.PaymentWhereInput["status"];
  if (sp.gateway) where.gateway = sp.gateway as Prisma.PaymentWhereInput["gateway"];
  if (sp.q) where.OR = [{ reference: { contains: sp.q, mode: "insensitive" } }, { gatewayPaymentId: { contains: sp.q } }, { booking: { reference: { contains: sp.q, mode: "insensitive" } } }, { booking: { clientName: { contains: sp.q, mode: "insensitive" } } }, { booking: { clientEmail: { contains: sp.q, mode: "insensitive" } } }];
  const [payments, refunds] = await Promise.all([
    prisma.payment.findMany({ where, include: { booking: true }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.refund.findMany({ include: { payment: { include: { booking: true } }, createdBy: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return (
    <>
      <PageTitle title="Payments & Refunds"><a className="btn-ghost btn-sm" href="/api/admin/export?type=payments">Export CSV</a></PageTitle>
      <form className="card mb-5 grid gap-3 p-4 sm:grid-cols-4" method="get">
        <input className="input sm:col-span-2" name="q" defaultValue={sp.q} placeholder="Transaction ID, reference, client…" aria-label="Search payments" />
        <select className="input" name="status" defaultValue={sp.status ?? ""} aria-label="Status"><option value="">All statuses</option>{["PENDING", "SUCCEEDED", "FAILED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"].map((x) => <option key={x} value={x}>{x.replace("_", " ").toLowerCase()}</option>)}</select>
        <div className="flex gap-2"><select className="input" name="gateway" defaultValue={sp.gateway ?? ""} aria-label="Gateway"><option value="">All gateways</option><option value="STRIPE">Stripe</option><option value="BANK_TRANSFER">Bank transfer</option><option value="MOCK">Test</option></select><button className="btn-primary btn-sm">Filter</button></div>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-x min-w-[1000px]">
          <thead><tr><th>Date</th><th>Transaction</th><th>Booking</th><th>Client</th><th>Amount</th><th>Gateway</th><th>Status</th><th>Refunded</th><th></th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap text-xs">{formatInTz(p.paidAt ?? p.createdAt, s.timezone, { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="font-mono text-xs">{p.reference}<span className="block text-muted">{p.gatewayPaymentId ?? ""}</span></td>
                <td><Link className="font-mono text-xs font-semibold text-brand" href={`/admin/meetings/${p.bookingId}`}>{p.booking.reference}</Link></td>
                <td>{p.booking.clientName}<span className="block text-xs text-muted">{p.booking.clientEmail}</span></td>
                <td className="font-semibold">{formatMoney(p.amountCents, p.currency)}</td>
                <td className="text-xs">{p.gateway}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{p.refundedCents ? formatMoney(p.refundedCents, p.currency) : "—"}</td>
                <td className="whitespace-nowrap">
                  {["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(p.status) && <Link className="text-xs font-semibold text-brand" href={`/receipt/${p.reference}`}>Receipt</Link>}
                  {me.role === "ADMIN" && ["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(p.status) && <RefundForm paymentId={p.id} max={p.amountCents - p.refundedCents} currency={p.currency} />}
                </td>
              </tr>
            ))}
            {!payments.length && <tr><td colSpan={9} className="py-6 text-center text-muted">No payments found.</td></tr>}
          </tbody>
        </table>
      </div>
      <h2 className="mb-3 mt-10 text-lg font-extrabold">Recent refunds</h2>
      <div className="card overflow-x-auto">
        <table className="table-x min-w-[700px]">
          <thead><tr><th>Date</th><th>Payment</th><th>Booking</th><th>Amount</th><th>Reason</th><th>By</th></tr></thead>
          <tbody>
            {refunds.map((r) => (
              <tr key={r.id}><td className="text-xs">{formatInTz(r.createdAt, s.timezone, { dateStyle: "medium", timeStyle: "short" })}</td><td className="font-mono text-xs">{r.payment.reference}</td><td className="font-mono text-xs">{r.payment.booking.reference}</td><td>{formatMoney(r.amountCents, r.payment.currency)}</td><td>{r.reason || "—"}</td><td>{r.createdBy?.name ?? "—"}</td></tr>
            ))}
            {!refunds.length && <tr><td colSpan={6} className="py-4 text-center text-muted">No refunds yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
