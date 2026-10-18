import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { addDays, dateInTz, zonedToUtc } from "@/lib/tz";
import { formatMoney } from "@/lib/util";
import { PageTitle, Stat } from "@/components/AdminBits";

export const metadata = { title: "Reports" };

const RANGES: [string, string][] = [["day", "Today"], ["week", "Last 7 days"], ["month", "Last 30 days"], ["custom", "Custom"]];

export default async function Reports({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const tz = s.timezone;
  const today = dateInTz(new Date(), tz);
  const range = RANGES.some(([k]) => k === sp.range) ? sp.range! : "month";
  const valid = (d?: string) => d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
  let from = today, to = today;
  if (range === "week") from = addDays(today, -6);
  if (range === "month") from = addDays(today, -29);
  if (range === "custom") { from = valid(sp.from) ?? addDays(today, -29); to = valid(sp.to) ?? today; if (to < from) [from, to] = [to, from]; }
  const start = zonedToUtc(from, 0, tz), end = zonedToUtc(addDays(to, 1), 0, tz);

  const [bookings, payments, refunds, outstanding, services] = await Promise.all([
    prisma.booking.findMany({ where: { startAt: { gte: start, lt: end }, status: { not: "EXPIRED" } }, select: { startAt: true, status: true, serviceId: true, totalCents: true } }),
    prisma.payment.findMany({ where: { paidAt: { gte: start, lt: end }, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } }, select: { amountCents: true, paidAt: true, gateway: true } }),
    prisma.refund.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { amountCents: true }, _count: true }),
    prisma.booking.findMany({ where: { status: { in: ["CONFIRMED", "PENDING_APPROVAL", "PENDING_PAYMENT", "COMPLETED"] } }, select: { totalCents: true, paidCents: true, refundedCents: true } }),
    prisma.meetingService.findMany({ select: { id: true, name: true } }),
  ]);

  const revenue = payments.reduce((n, p) => n + p.amountCents, 0);
  const refunded = refunds._sum.amountCents ?? 0;
  const owed = outstanding.reduce((n, b) => n + Math.max(0, b.totalCents - b.paidCents), 0);
  const completed = bookings.filter((b) => b.status === "COMPLETED").length;
  const cancelled = bookings.filter((b) => b.status === "CANCELLED" || b.status === "REJECTED").length;

  // Daily series across the range (capped at 92 days for readability).
  const days: string[] = [];
  for (let d = from; d <= to && days.length < 92; d = addDays(d, 1)) days.push(d);
  const perDay = new Map(days.map((d) => [d, { count: 0, cents: 0 }]));
  for (const b of bookings) { const e = perDay.get(dateInTz(b.startAt, tz)); if (e) e.count++; }
  for (const p of payments) { const e = p.paidAt && perDay.get(dateInTz(p.paidAt, tz)); if (e) e.cents += p.amountCents; }
  const maxCount = Math.max(1, ...[...perDay.values()].map((v) => v.count));

  const byService = services.map((sv) => {
    const list = bookings.filter((b) => b.serviceId === sv.id);
    return { name: sv.name, total: list.length, completed: list.filter((b) => b.status === "COMPLETED").length, cancelled: list.filter((b) => b.status === "CANCELLED" || b.status === "REJECTED").length, value: list.filter((b) => b.status !== "CANCELLED" && b.status !== "REJECTED").reduce((n, b) => n + b.totalCents, 0) };
  }).filter((x) => x.total).sort((a, b) => b.total - a.total);
  const byGateway = payments.reduce<Record<string, number>>((m, p) => ({ ...m, [p.gateway]: (m[p.gateway] ?? 0) + p.amountCents }), {});

  return (
    <>
      <PageTitle title="Reports" sub={`${from} → ${to} · ${tz}`}>
        <a className="btn-ghost btn-sm" href={`/api/admin/export?type=bookings&from=${from}&to=${to}`}>Export bookings</a>
        <a className="btn-ghost btn-sm" href={`/api/admin/export?type=payments`}>Export payments</a>
      </PageTitle>
      <form className="card mb-5 flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="flex rounded-full border border-line bg-white p-1 text-sm">
          {RANGES.filter(([k]) => k !== "custom").map(([k, l]) => <Link key={k} href={`?range=${k}`} className={`rounded-full px-3 py-1.5 font-semibold ${range === k ? "bg-navy text-white" : "text-ink"}`}>{l}</Link>)}
        </div>
        <input type="hidden" name="range" value="custom" />
        <div><label className="label text-xs">From</label><input className="input" type="date" name="from" defaultValue={from} /></div>
        <div><label className="label text-xs">To</label><input className="input" type="date" name="to" defaultValue={to} /></div>
        <button className="btn-primary btn-sm">Apply custom range</button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Bookings" value={bookings.length} hint="Meetings scheduled in range" />
        <Stat label="Completed" value={completed} />
        <Stat label="Cancelled / rejected" value={cancelled} />
        <Stat label="Payments received" value={formatMoney(revenue, s.currency)} hint={`${payments.length} payment(s)`} />
        <Stat label="Refunds" value={formatMoney(refunded, s.currency)} hint={`${refunds._count} refund(s)`} />
        <Stat label="Outstanding (all time)" value={formatMoney(owed, s.currency)} hint="Unpaid balances on active bookings" />
      </div>

      <section className="card mt-6 p-5">
        <h2 className="font-extrabold">Booking trend</h2>
        <div className="mt-4 overflow-x-auto">
          <div className="flex h-48 min-w-[600px] items-end gap-[3px]">
            {days.map((d) => { const v = perDay.get(d)!; return (
              <div key={d} className="group relative flex flex-1 flex-col items-center justify-end" title={`${d}: ${v.count} booking(s), ${formatMoney(v.cents, s.currency)} received`}>
                <div className="w-full rounded-t bg-brand/80 group-hover:bg-brand" style={{ height: `${(v.count / maxCount) * 100}%`, minHeight: v.count ? 4 : 1 }} />
              </div>
            ); })}
          </div>
          <div className="mt-2 flex min-w-[600px] justify-between text-xs text-muted"><span>{days[0]}</span><span>{days[days.length - 1]}</span></div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="card overflow-x-auto p-5">
          <h2 className="font-extrabold">By meeting type</h2>
          <table className="table-x mt-3 min-w-[560px]">
            <thead><tr><th>Meeting type</th><th>Bookings</th><th>Completed</th><th>Cancelled</th><th>Booked value</th></tr></thead>
            <tbody>
              {byService.map((x) => <tr key={x.name}><td className="font-semibold text-ink">{x.name}</td><td>{x.total}</td><td>{x.completed}</td><td>{x.cancelled}</td><td>{formatMoney(x.value, s.currency)}</td></tr>)}
              {!byService.length && <tr><td colSpan={5} className="py-4 text-center text-muted">No bookings in this range.</td></tr>}
            </tbody>
          </table>
        </section>
        <section className="card p-5">
          <h2 className="font-extrabold">Revenue by gateway</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {Object.entries(byGateway).map(([g, c]) => <li key={g} className="flex justify-between py-2"><span>{g === "BANK_TRANSFER" ? "Bank transfer" : g === "MOCK" ? "Test payments" : "Stripe"}</span><b className="text-ink">{formatMoney(c, s.currency)}</b></li>)}
            {!payments.length && <li className="py-2 text-muted">No payments in this range.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
