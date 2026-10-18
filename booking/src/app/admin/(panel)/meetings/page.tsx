import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { bookingWhere } from "@/lib/admin-filters";
import { dateInTz, zonedToUtc } from "@/lib/tz";
import { formatInTz, formatMoney, formatTimeInTz } from "@/lib/util";
import { PageTitle } from "@/components/AdminBits";
import { StatusBadge } from "@/components/SiteChrome";

export const metadata = { title: "Meetings" };
const STATUSES = ["HELD", "PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"];
const PAY = ["UNPAID", "PENDING", "PAID", "PARTIALLY_PAID", "FAILED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"];
const PAGE = 50;

export default async function Meetings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const view = sp.view === "list" || sp.view === "calendar" ? sp.view : "table";
  const page = Math.max(1, Number(sp.page) || 1);
  const [services, team] = await Promise.all([
    prisma.meetingService.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] }, active: true }, orderBy: { name: "asc" } }),
  ]);
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][]);
    return `?${p.toString()}`;
  };

  // Calendar view: one month in the business time zone.
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : dateInTz(new Date(), s.timezone).slice(0, 7);
  const [cy, cm] = month.split("-").map(Number);
  const where = bookingWhere(sp);
  if (view === "calendar") {
    where.startAt = { gte: zonedToUtc(`${month}-01`, 0, s.timezone), lt: zonedToUtc(new Date(Date.UTC(cy, cm, 1)).toISOString().slice(0, 10), 0, s.timezone) };
  }
  const [rows, count] = await Promise.all([
    prisma.booking.findMany({ where, include: { service: true, assignedTo: true }, orderBy: { startAt: view === "calendar" ? "asc" : "desc" }, ...(view === "calendar" ? {} : { skip: (page - 1) * PAGE, take: PAGE }) }),
    prisma.booking.count({ where }),
  ]);
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !["view", "page", "month"].includes(k)) as [string, string][]);

  return (
    <>
      <PageTitle title="Meetings" sub={`${count} booking${count === 1 ? "" : "s"} · times in ${s.timezone}`}>
        <div className="flex rounded-full border border-line bg-white p-1 text-sm">
          {(["table", "list", "calendar"] as const).map((v) => <Link key={v} href={qs({ view: v, page: undefined })} className={`rounded-full px-3 py-1.5 font-semibold capitalize ${view === v ? "bg-navy text-white" : "text-ink"}`}>{v}</Link>)}
        </div>
        <a className="btn-ghost btn-sm" href={`/api/admin/export?type=bookings&${exportQs}`}>Export CSV</a>
      </PageTitle>

      <form className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" method="get">
        <input type="hidden" name="view" value={view} />
        <input className="input xl:col-span-2" name="q" defaultValue={sp.q} placeholder="Search client, email, reference, title…" aria-label="Search" />
        <select className="input" name="service" defaultValue={sp.service ?? ""} aria-label="Meeting type"><option value="">All meeting types</option>{services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select className="input" name="status" defaultValue={sp.status ?? ""} aria-label="Status"><option value="">All statuses (hide expired)</option>{STATUSES.map((x) => <option key={x} value={x}>{x.replace(/_/g, " ").toLowerCase()}</option>)}</select>
        <select className="input" name="payment" defaultValue={sp.payment ?? ""} aria-label="Payment status"><option value="">Any payment status</option>{PAY.map((x) => <option key={x} value={x}>{x.replace(/_/g, " ").toLowerCase()}</option>)}</select>
        <select className="input" name="assigned" defaultValue={sp.assigned ?? ""} aria-label="Team member"><option value="">Any team member</option>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="request" value="1" defaultChecked={sp.request === "1"} /> Open requests</label>
        {view !== "calendar" && <><input className="input" type="date" name="from" defaultValue={sp.from} aria-label="From date" /><input className="input" type="date" name="to" defaultValue={sp.to} aria-label="To date" /></>}
        <div className="flex gap-2"><button className="btn-primary btn-sm">Filter</button><Link className="btn-ghost btn-sm" href={`?view=${view}`}>Reset</Link></div>
      </form>

      {view === "table" && (
        <div className="card overflow-x-auto">
          <table className="table-x min-w-[960px]">
            <thead><tr><th>When</th><th>Client</th><th>Meeting</th><th>Status</th><th>Payment</th><th>Total</th><th>Assigned</th><th>Ref</th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-soft">
                  <td className="whitespace-nowrap"><Link className="font-semibold text-brand" href={`/admin/meetings/${b.id}`}>{formatInTz(b.startAt, s.timezone, { dateStyle: "medium", timeStyle: "short" })}</Link></td>
                  <td>{b.clientName}<span className="block text-xs text-muted">{b.clientEmail}</span></td>
                  <td>{b.service.name}<span className="block max-w-xs truncate text-xs text-muted">{b.title}</span>{b.changeRequest !== "NONE" && <span className="text-xs font-semibold text-amber-700">Request: {b.changeRequest.toLowerCase()}</span>}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td><StatusBadge status={b.paymentStatus} /></td>
                  <td className="whitespace-nowrap">{formatMoney(b.totalCents, b.currency)}</td>
                  <td>{b.assignedTo?.name ?? <span className="text-muted">—</span>}</td>
                  <td className="font-mono text-xs">{b.reference}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className="py-8 text-center text-muted">No bookings match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {view === "list" && (
        <ul className="space-y-3">
          {rows.map((b) => (
            <li key={b.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/admin/meetings/${b.id}`} className="font-display font-extrabold text-ink hover:text-brand">{b.title}</Link>
                  <p className="text-sm">{formatInTz(b.startAt, s.timezone, { dateStyle: "full", timeStyle: "short" })} · {b.durationMin} min · {b.service.name}</p>
                  <p className="mt-1 text-sm">{b.clientName} · {b.clientEmail} · {b.clientPhone}{b.company ? ` · ${b.company}` : ""}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{b.purpose}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5"><StatusBadge status={b.status} /><StatusBadge status={b.paymentStatus} /><span className="font-mono text-xs">{b.reference}</span></div>
              </div>
            </li>
          ))}
          {!rows.length && <li className="card p-8 text-center text-muted">No bookings match these filters.</li>}
        </ul>
      )}

      {view === "calendar" && (() => {
        const first = new Date(Date.UTC(cy, cm - 1, 1));
        const days = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
        const lead = (first.getUTCDay() + 6) % 7;
        const byDay = new Map<string, typeof rows>();
        for (const b of rows) { const k = dateInTz(b.startAt, s.timezone); byDay.set(k, [...(byDay.get(k) ?? []), b]); }
        const prev = new Date(Date.UTC(cy, cm - 2, 1)).toISOString().slice(0, 7), next = new Date(Date.UTC(cy, cm, 1)).toISOString().slice(0, 7);
        return (
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <Link className="btn-ghost btn-sm" href={qs({ month: prev })}>‹ Prev</Link>
              <h2 className="font-extrabold">{new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(first)}</h2>
              <Link className="btn-ghost btn-sm" href={qs({ month: next })}>Next ›</Link>
            </div>
            <div className="overflow-x-auto"><div className="grid min-w-[760px] grid-cols-7 gap-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="p-1 text-center text-xs font-semibold text-muted">{d}</div>)}
              {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
              {Array.from({ length: days }).map((_, i) => {
                const key = `${month}-${String(i + 1).padStart(2, "0")}`;
                const list = byDay.get(key) ?? [];
                return (
                  <div key={key} className="min-h-28 rounded-lg border border-line bg-white p-1.5">
                    <p className="text-xs font-bold text-muted">{i + 1}</p>
                    <ul className="mt-1 space-y-1">
                      {list.map((b) => (
                        <li key={b.id}><Link href={`/admin/meetings/${b.id}`} className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-semibold ${b.status === "CONFIRMED" ? "bg-green-100 text-green-900" : b.status === "COMPLETED" ? "bg-slate-200 text-slate-800" : b.status === "CANCELLED" || b.status === "REJECTED" ? "bg-red-100 text-red-800 line-through" : "bg-amber-100 text-amber-900"}`}>
                          {formatTimeInTz(b.startAt, s.timezone)} {b.clientName}</Link></li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div></div>
          </div>
        );
      })()}

      {view !== "calendar" && count > PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span>Page {page} of {Math.ceil(count / PAGE)}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="btn-ghost btn-sm" href={qs({ page: String(page - 1) })}>Previous</Link>}
            {page * PAGE < count && <Link className="btn-ghost btn-sm" href={qs({ page: String(page + 1) })}>Next</Link>}
          </div>
        </div>
      )}
    </>
  );
}
