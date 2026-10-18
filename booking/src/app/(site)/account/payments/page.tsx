import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatInTz, formatMoney } from "@/lib/util";
import AccountNav from "@/components/AccountNav";
import { StatusBadge } from "@/components/SiteChrome";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment History" };

export default async function Payments() {
  const user = await requireUser(["CLIENT"]);
  const payments = await prisma.payment.findMany({ where: { booking: { client: { userId: user.id } } }, include: { booking: { include: { service: true } }, refunds: true }, orderBy: { createdAt: "desc" } });
  return (
    <div className="container-x py-10">
      <AccountNav active="/account/payments" name={user.name} />
      <div className="card overflow-x-auto">
        <table className="table-x min-w-[720px]">
          <thead><tr><th>Date</th><th>Payment</th><th>Meeting</th><th>Amount</th><th>Status</th><th>Refunded</th><th></th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{formatInTz(p.createdAt, p.booking.clientTimezone, { dateStyle: "medium", timeStyle: undefined })}</td>
                <td className="font-mono text-xs">{p.reference}</td>
                <td>{p.booking.service.name}<span className="block text-xs text-muted">Ref {p.booking.reference}</span></td>
                <td className="font-semibold">{formatMoney(p.amountCents, p.currency)}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{p.refundedCents ? formatMoney(p.refundedCents, p.currency) : "—"}</td>
                <td>{["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(p.status) && <Link className="font-semibold text-brand" href={`/receipt/${p.reference}`}>Receipt</Link>}</td>
              </tr>
            ))}
            {!payments.length && <tr><td colSpan={7} className="py-6 text-center text-muted">No payments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
