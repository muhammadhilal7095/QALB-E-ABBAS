import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatInTz, formatMoney } from "@/lib/util";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment Receipt" };

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ token?: string }> }) {
  const { ref } = await params;
  const { token } = await searchParams;
  const p = await prisma.payment.findUnique({ where: { reference: ref }, include: { booking: { include: { service: true, client: true } }, refunds: true } });
  const user = await getCurrentUser();
  if (!p || !((token && token === p.booking.manageToken) || (user && p.booking.client.userId === user.id) || isStaff(user))) notFound();
  if (!["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(p.status)) notFound();
  const s = await getSettings();
  const b = p.booking;
  const row = (k: string, v: React.ReactNode) => <tr><td className="py-2 pr-4 text-muted">{k}</td><td className="py-2 text-right font-semibold text-ink">{v}</td></tr>;
  return (
    <div className="container-x max-w-2xl py-10">
      <div className="card p-8">
        <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt={s.businessName} className="h-9 w-auto" />
            <p className="mt-3 text-xs text-muted whitespace-pre-line">{s.emailFooter.replace(/ · /g, "\n")}</p>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-extrabold">Receipt</h1>
            <p className="font-mono text-sm">{p.reference}</p>
            <p className="text-sm text-muted">{p.paidAt ? formatInTz(p.paidAt, s.timezone, { dateStyle: "medium", timeStyle: undefined }) : ""}</p>
          </div>
        </div>
        <p className="mt-5 text-sm"><b className="text-ink">Billed to:</b> {b.clientName}{b.company ? `, ${b.company}` : ""} · {b.clientEmail}</p>
        <table className="mt-4 w-full text-sm"><tbody>
          {row("Booking reference", b.reference)}
          {row("Service", b.service.name)}
          {row("Meeting date", formatInTz(b.startAt, b.clientTimezone, { dateStyle: "medium", timeStyle: "short" }))}
          {row("Booking total", formatMoney(b.totalCents, b.currency))}
          {b.discountCents > 0 && row("Includes discount", `−${formatMoney(b.discountCents, b.currency)}`)}
          {b.taxCents > 0 && row(`Includes ${s.taxLabel}`, formatMoney(b.taxCents, b.currency))}
          {row("Payment method", p.gateway === "STRIPE" ? "Card (Stripe)" : p.gateway === "BANK_TRANSFER" ? "Bank transfer" : "Test payment")}
          {row("Amount paid", <span className="text-base">{formatMoney(p.amountCents, p.currency)}</span>)}
          {p.refundedCents > 0 && row("Refunded", `−${formatMoney(p.refundedCents, p.currency)}`)}
        </tbody></table>
        <p className="mt-6 text-xs text-muted">Thank you for your business. Keep this receipt for your records.</p>
        <div className="no-print mt-6"><PrintButton /></div>
      </div>
    </div>
  );
}
