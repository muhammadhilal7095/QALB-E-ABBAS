import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { zonedToUtc, dateInTz, addDays } from "@/lib/tz";
import { formatMoney, formatTimeInTz, formatInTz } from "@/lib/util";
import { PageTitle, Stat } from "@/components/AdminBits";
import { StatusBadge } from "@/components/SiteChrome";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const s = await getSettings();
  const now = new Date();
  const today = dateInTz(now, s.timezone);
  const dayStart = zonedToUtc(today, 0, s.timezone), dayEnd = zonedToUtc(addDays(today, 1), 0, s.timezone);
  const live = { notIn: ["EXPIRED" as const] };
  const [total, todays, upcoming, completed, cancelled, pendingPay, successPay, revenue, refunds, newClients, attention, todayList] = await Promise.all([
    prisma.booking.count({ where: { status: live } }),
    prisma.booking.count({ where: { startAt: { gte: dayStart, lt: dayEnd }, status: { in: ["CONFIRMED", "PENDING_APPROVAL", "COMPLETED"] } } }),
    prisma.booking.count({ where: { startAt: { gte: now }, status: { in: ["CONFIRMED", "PENDING_APPROVAL"] } } }),
    prisma.booking.count({ where: { status: "COMPLETED" } }),
    prisma.booking.count({ where: { status: { in: ["CANCELLED", "REJECTED"] } } }),
    prisma.booking.count({ where: { status: { in: ["HELD", "PENDING_PAYMENT"] }, OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }] } }),
    prisma.payment.count({ where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } } }),
    prisma.payment.aggregate({ where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } }, _sum: { amountCents: true, refundedCents: true } }),
    prisma.refund.aggregate({ _sum: { amountCents: true }, _count: true }),
    prisma.client.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * 86400_000) } } }),
    prisma.booking.findMany({ where: { OR: [{ status: "PENDING_APPROVAL" }, { changeRequest: { not: "NONE" } }, { status: "EXPIRED", paidCents: { gt: 0 }, refundedCents: 0 }] }, include: { service: true }, orderBy: { startAt: "asc" }, take: 10 }),
    prisma.booking.findMany({ where: { startAt: { gte: dayStart, lt: dayEnd }, status: { in: ["CONFIRMED", "PENDING_APPROVAL", "COMPLETED"] } }, include: { service: true, meetingLink: true }, orderBy: { startAt: "asc" } }),
  ]);
  const cur = s.currency;
  const net = (revenue._sum.amountCents ?? 0) - (revenue._sum.refundedCents ?? 0);
  return (
    <>
      <PageTitle title="Dashboard" sub={`Today is ${formatInTz(now, s.timezone, { dateStyle: "full", timeStyle: undefined })} · times in ${s.timezone}`}>
        <Link href="/admin/meetings?view=calendar" className="btn-ghost btn-sm">Calendar</Link>
        <Link href="/" className="btn-gold btn-sm">Booking page</Link>
      </PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total bookings" value={total} />
        <Stat label="Today's meetings" value={todays} />
        <Stat label="Upcoming" value={upcoming} />
        <Stat label="Completed" value={completed} />
        <Stat label="Cancelled" value={cancelled} />
        <Stat label="Pending payments" value={pendingPay} />
        <Stat label="Successful payments" value={successPay} />
        <Stat label="Total revenue" value={formatMoney(net, cur)} hint="Net of refunds" />
        <Stat label="Refunds" value={formatMoney(refunds._sum.amountCents ?? 0, cur)} hint={`${refunds._count} refund(s)`} />
        <Stat label="New clients" value={newClients} hint="Last 30 days" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-extrabold">Today&apos;s schedule</h2>
          {todayList.length ? (
            <ul className="mt-3 divide-y divide-line">
              {todayList.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span><b className="text-ink">{formatTimeInTz(b.startAt, s.timezone)}</b> · {b.service.name} · {b.clientName}</span>
                  <span className="flex items-center gap-2">{!b.meetingLink?.url && b.status === "CONFIRMED" && <span className="text-xs font-semibold text-amber-700">No link yet</span>}<StatusBadge status={b.status} /><Link className="font-semibold text-brand" href={`/admin/meetings/${b.id}`}>Open</Link></span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">No meetings today.</p>}
        </section>
        <section className="card p-5">
          <h2 className="font-extrabold">Needs attention</h2>
          {attention.length ? (
            <ul className="mt-3 divide-y divide-line">
              {attention.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span>{b.clientName} · {b.service.name}<span className="block text-xs text-muted">
                    {b.status === "PENDING_APPROVAL" ? "Awaiting approval" : b.changeRequest !== "NONE" ? `Client requested ${b.changeRequest.toLowerCase()}` : "Paid after reservation expired — reschedule or refund"}</span></span>
                  <Link className="btn-outline btn-sm" href={`/admin/meetings/${b.id}`}>Review</Link>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">Nothing needs your attention right now.</p>}
        </section>
      </div>
    </>
  );
}
