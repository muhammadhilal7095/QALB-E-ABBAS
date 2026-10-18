import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatInTz, formatMoney, tzAbbrev } from "@/lib/util";
import { StatusBadge } from "@/components/SiteChrome";
import { AssignForm, BookingActions, MeetingLinkForm, NoteForm, RefundForm, RescheduleForm } from "@/components/AdminUI";

export const metadata = { title: "Meeting" };

export default async function MeetingDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffPage();
  const { id } = await params;
  const [b, s, team] = await Promise.all([
    prisma.booking.findUnique({
      where: { id },
      include: {
        service: true, client: true, meetingLink: true, attachments: true, coupon: true, assignedTo: true,
        payments: { include: { refunds: true }, orderBy: { createdAt: "asc" } },
        events: { orderBy: { createdAt: "desc" } }, notes_: { include: { author: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    getSettings(),
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!b) notFound();
  const isAdmin = user.role === "ADMIN";
  const tz = s.timezone;
  const row = (k: string, v: React.ReactNode) => <div className="grid grid-cols-[150px_1fr] gap-3 py-2"><dt className="text-muted">{k}</dt><dd className="min-w-0 whitespace-pre-line break-words text-ink">{v || <span className="text-muted">—</span>}</dd></div>;

  return (
    <>
      <Link href="/admin/meetings" className="text-sm font-semibold text-brand">← All meetings</Link>
      <div className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">{b.title}</h1>
          <p className="mt-1 text-sm">{b.service.name} · <span className="font-mono">{b.reference}</span></p>
        </div>
        <div className="flex gap-2"><StatusBadge status={b.status} /><StatusBadge status={b.paymentStatus} /></div>
      </div>

      {b.changeRequest !== "NONE" && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <b>Client requested {b.changeRequest === "CANCEL" ? "cancellation" : "rescheduling"}:</b> <span className="whitespace-pre-line">{b.changeMessage}</span>
        </div>
      )}
      {b.status === "EXPIRED" && b.paidCents > b.refundedCents && (
        <div className="mb-5 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"><b>Payment received after the reservation expired.</b> Reschedule this meeting to a free slot or refund the client.</div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="font-extrabold">Actions</h2>
            <div className="mt-3"><BookingActions id={b.id} status={b.status} paid={b.paidCents} due={b.dueNowCents} isAdmin={isAdmin} hasRequest={b.changeRequest !== "NONE"} /></div>
            {["CONFIRMED", "PENDING_APPROVAL", "PENDING_PAYMENT", "HELD", "EXPIRED"].includes(b.status) && (
              <details className="mt-4 rounded-xl border border-line p-3"><summary className="cursor-pointer text-sm font-semibold text-ink">Reschedule</summary><div className="mt-3"><RescheduleForm id={b.id} tz={tz} /></div></details>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-extrabold">Meeting purpose &amp; requirements</h2>
            <dl className="mt-2 divide-y divide-line text-sm">
              {row("Purpose", b.purpose)}
              {row("Requirements", b.description)}
              {row("Questions", b.questions)}
              {row("Expected outcome", b.expectedOutcome)}
              {row("Notes", b.notes)}
              {row("Attachments", b.attachments.length ? <ul>{b.attachments.map((a) => <li key={a.id}><a className="text-brand underline" href={`/api/attachments/${a.id}`}>{a.filename}</a> <span className="text-muted">({Math.round(a.size / 1024)} KB)</span></li>)}</ul> : null)}
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="font-extrabold">Payments</h2>
            <dl className="mt-2 grid gap-x-6 text-sm sm:grid-cols-2">
              {row("Fee", formatMoney(b.priceCents, b.currency))}
              {row("Discount", b.discountCents ? `−${formatMoney(b.discountCents, b.currency)}${b.coupon ? ` (${b.coupon.code})` : ""}` : null)}
              {row("Tax", b.taxCents ? formatMoney(b.taxCents, b.currency) : null)}
              {row("Total", formatMoney(b.totalCents, b.currency))}
              {row("Due at booking", formatMoney(b.dueNowCents, b.currency))}
              {row("Paid / refunded", `${formatMoney(b.paidCents, b.currency)} / ${formatMoney(b.refundedCents, b.currency)}`)}
            </dl>
            <div className="mt-3 overflow-x-auto">
              <table className="table-x min-w-[640px]">
                <thead><tr><th>Payment</th><th>Gateway</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {b.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs">{p.reference}{p.gatewayPaymentId && <span className="block text-muted">{p.gatewayPaymentId}</span>}</td>
                      <td>{p.gateway}</td>
                      <td>{formatMoney(p.amountCents, p.currency)}{p.refundedCents > 0 && <span className="block text-xs text-purple-700">−{formatMoney(p.refundedCents, p.currency)} refunded</span>}</td>
                      <td><StatusBadge status={p.status} />{p.failureReason && <span className="block text-xs text-muted">{p.failureReason}</span>}</td>
                      <td className="whitespace-nowrap text-xs">{formatInTz(p.paidAt ?? p.createdAt, tz, { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td>
                        {["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(p.status) && <Link className="text-xs font-semibold text-brand" href={`/receipt/${p.reference}`}>Receipt</Link>}
                        {isAdmin && ["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(p.status) && <div className="mt-1"><RefundForm paymentId={p.id} max={p.amountCents - p.refundedCents} currency={p.currency} /></div>}
                      </td>
                    </tr>
                  ))}
                  {!b.payments.length && <tr><td colSpan={6} className="py-4 text-center text-muted">No payment attempts yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-extrabold">History</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-line pl-4 text-sm">
              {b.events.map((e) => <li key={e.id}><p className="text-ink">{e.message}</p><p className="text-xs text-muted">{formatInTz(e.createdAt, tz, { dateStyle: "medium", timeStyle: "short" })} · {e.type}</p></li>)}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="font-extrabold">When</h2>
            <p className="mt-2 text-sm text-ink">{formatInTz(b.startAt, tz, { dateStyle: "full", timeStyle: "short" })} ({tzAbbrev(b.startAt, tz)}) · {b.durationMin} min</p>
            {b.clientTimezone !== tz && <p className="mt-1 text-xs text-muted">Client time: {formatInTz(b.startAt, b.clientTimezone, { dateStyle: "medium", timeStyle: "short" })} ({b.clientTimezone})</p>}
            {b.holdExpiresAt && ["HELD", "PENDING_PAYMENT"].includes(b.status) && <p className="mt-2 text-xs font-semibold text-amber-700">Reservation expires {formatInTz(b.holdExpiresAt, tz, { dateStyle: "medium", timeStyle: "short" })}</p>}
          </section>
          <section className="card p-5">
            <h2 className="font-extrabold">Client</h2>
            <dl className="mt-2 divide-y divide-line text-sm">
              {row("Name", <Link className="text-brand" href={`/admin/clients/${b.clientId}`}>{b.clientName}</Link>)}
              {row("Email", <a className="text-brand" href={`mailto:${b.clientEmail}`}>{b.clientEmail}</a>)}
              {row("Phone", <a className="text-brand" href={`tel:${b.clientPhone}`}>{b.clientPhone}</a>)}
              {row("Company", b.company)}
              {row("Website", b.website ? <a className="text-brand" href={b.website} target="_blank" rel="noopener noreferrer nofollow">{b.website}</a> : null)}
              {row("Country", b.country)}
              {row("Contact via", b.commMethod)}
              {row("Platform", b.platformPref)}
              {row("Additional", b.additionalInfo)}
            </dl>
          </section>
          <section className="card p-5">
            <h2 className="font-extrabold">Meeting link</h2>
            <p className="mb-3 mt-1 text-xs text-muted">Shared only with this client (on their booking page and emails) and the team.</p>
            <MeetingLinkForm id={b.id} initial={{ platform: b.meetingLink?.platform ?? (b.platformPref === "Zoom" ? "ZOOM" : b.platformPref === "Microsoft Teams" ? "TEAMS" : "GOOGLE_MEET"), url: b.meetingLink?.url ?? "", instructions: b.meetingLink?.instructions ?? "" }} />
          </section>
          <section className="card p-5">
            <h2 className="font-extrabold">Assigned to</h2>
            <div className="mt-3"><AssignForm id={b.id} current={b.assignedToId} team={team} /></div>
          </section>
          <section className="card p-5">
            <h2 className="font-extrabold">Internal notes</h2>
            <div className="mt-3"><NoteForm id={b.id} /></div>
            <ul className="mt-4 space-y-3 text-sm">{b.notes_.map((n) => <li key={n.id} className="rounded-xl bg-soft p-3"><p className="whitespace-pre-line text-ink">{n.body}</p><p className="mt-1 text-xs text-muted">{n.author?.name ?? "Unknown"} · {formatInTz(n.createdAt, tz, { dateStyle: "medium", timeStyle: "short" })}</p></li>)}</ul>
          </section>
        </div>
      </div>
    </>
  );
}
