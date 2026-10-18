import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { env, getSettings } from "@/lib/settings";
import { verifyStripeSession } from "@/lib/webhooks";
import { formatInTz, formatMoney, tzAbbrev } from "@/lib/util";
import { StatusBadge } from "@/components/SiteChrome";
import RequestChange from "@/components/RequestChange";
import { RefreshWhilePending } from "@/components/Checkout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your Booking" };

export default async function BookingPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { ref } = await params;
  const sp = await searchParams;
  const load = () => prisma.booking.findUnique({
    where: { reference: ref },
    include: { service: true, client: true, meetingLink: true, payments: { orderBy: { createdAt: "asc" } }, attachments: true },
  });
  let b = await load();
  const user = await getCurrentUser();
  const allowed = b && ((sp.token && sp.token === b.manageToken) || (user && b.client.userId === user.id) || isStaff(user));
  if (!b || !allowed) notFound();

  // Returning from Stripe: verify directly with Stripe in case the webhook hasn't arrived yet.
  let verifyFailed = false;
  if (sp.session_id && env.stripeConfigured() && b.paymentStatus !== "PAID") {
    try { if (await verifyStripeSession(sp.session_id)) b = (await load())!; } catch { verifyFailed = true; }
  }

  const settings = await getSettings();
  const tz = b.clientTimezone;
  const time = `${formatInTz(b.startAt, tz, { dateStyle: undefined, timeStyle: "short" })} – ${formatInTz(b.endAt, tz, { dateStyle: undefined, timeStyle: "short" })} ${tzAbbrev(b.startAt, tz)}`;
  const tokenQ = sp.token ? `?token=${sp.token}` : "";
  const paid = b.payments.filter((p) => ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(p.status));
  const awaitingWebhook = b.status === "HELD" && b.payments.some((p) => p.status === "PENDING" && p.gateway === "STRIPE") && !!sp.session_id;

  const banners: Record<string, [string, string, string]> = {
    CONFIRMED: ["bg-green-50 border-green-200 text-green-900", "Your meeting is confirmed", "A confirmation email has been sent to " + b.clientEmail + "."],
    PENDING_APPROVAL: ["bg-blue-50 border-blue-200 text-blue-900", "Payment received — awaiting confirmation", "Our team will review your request and confirm your meeting shortly."],
    HELD: ["bg-amber-50 border-amber-200 text-amber-900", awaitingWebhook ? "Confirming your payment…" : "Awaiting payment", awaitingWebhook ? "This usually takes a few seconds." : "Your slot is reserved until the timer ends. Complete payment to confirm."],
    PENDING_PAYMENT: ["bg-amber-50 border-amber-200 text-amber-900", "Awaiting your bank transfer", `Please pay ${formatMoney(b.dueNowCents, b.currency)} using reference ${b.reference} by ${b.holdExpiresAt ? formatInTz(b.holdExpiresAt, tz, { dateStyle: "medium", timeStyle: "short" }) : "the deadline"}.`],
    EXPIRED: ["bg-slate-50 border-slate-200 text-slate-800", "This reservation has expired", b.paidCents > 0 ? "We received your payment after the reservation expired. Our team will contact you to reschedule or refund." : "Checkout was not completed in time, so the slot was released. You're welcome to book again."],
    CANCELLED: ["bg-red-50 border-red-200 text-red-900", "This meeting has been cancelled", "If a refund applies, you'll receive a confirmation email."],
    REJECTED: ["bg-red-50 border-red-200 text-red-900", "This booking could not be accepted", "If you paid, a refund will be processed. Please contact us with any questions."],
    COMPLETED: ["bg-slate-50 border-slate-200 text-slate-800", "Meeting completed", "Thank you for meeting with us."],
  };
  const [cls, title, sub] = banners[b.status];
  const row = (k: string, v: React.ReactNode) => <div className="grid grid-cols-[140px_1fr] gap-3 py-2.5 sm:grid-cols-[170px_1fr]"><dt className="text-muted">{k}</dt><dd className="font-medium text-ink">{v}</dd></div>;

  return (
    <div className="container-x py-10">
      {awaitingWebhook && <RefreshWhilePending seconds={3} />}
      <div className={`rounded-2xl border p-5 ${cls}`} role="status">
        <h1 className="font-display text-xl font-extrabold md:text-2xl">{title}</h1>
        <p className="mt-1 text-sm">{sub}</p>
        {verifyFailed && <p className="mt-2 text-sm">We couldn&apos;t verify the payment just now — this page will update once it&apos;s confirmed.</p>}
        {b.status === "HELD" && !awaitingWebhook && <Link className="btn-gold mt-4" href={`/book/checkout?booking=${b.reference}&token=${b.manageToken}`}>Complete payment</Link>}
        {b.status === "EXPIRED" && b.paidCents === 0 && <Link className="btn-primary mt-4" href={`/book/${b.service.slug}`}>Book again</Link>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold">Booking details</h2>
            <div className="flex gap-2"><StatusBadge status={b.status} /><StatusBadge status={b.paymentStatus} /></div>
          </div>
          <dl className="mt-3 divide-y divide-line text-sm">
            {row("Booking reference", <span className="font-mono font-bold">{b.reference}</span>)}
            {row("Client", b.clientName)}
            {row("Meeting", b.service.name)}
            {row("Title", b.title)}
            {row("Purpose", <span className="whitespace-pre-line">{b.purpose}</span>)}
            {row("Date", formatInTz(b.startAt, tz, { dateStyle: "full", timeStyle: undefined }))}
            {row("Time", <>{time}{tz !== settings.timezone && <span className="block text-xs text-muted">({formatInTz(b.startAt, settings.timezone, { dateStyle: undefined, timeStyle: "short" })} {tzAbbrev(b.startAt, settings.timezone)} our time)</span>}</>)}
            {row("Duration", `${b.durationMin} minutes`)}
            {row("Total", formatMoney(b.totalCents, b.currency))}
            {row("Amount paid", formatMoney(b.paidCents, b.currency))}
            {b.refundedCents > 0 && row("Refunded", formatMoney(b.refundedCents, b.currency))}
            {b.attachments.length > 0 && row("Attachments", <ul>{b.attachments.map((a) => <li key={a.id}><a className="text-brand underline" href={`/api/attachments/${a.id}${tokenQ}`}>{a.filename}</a></li>)}</ul>)}
          </dl>
        </section>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-extrabold">Joining your meeting</h2>
            {["CONFIRMED", "COMPLETED"].includes(b.status) ? (
              b.meetingLink?.url ? (
                <><p className="mt-2 text-sm">Platform: <b>{b.meetingLink.platform.replace("_", " ")}</b></p><a className="btn-gold mt-3 w-full" href={b.meetingLink.url} target="_blank" rel="noopener noreferrer">Join meeting</a>{b.meetingLink.instructions && <p className="mt-3 whitespace-pre-line text-sm">{b.meetingLink.instructions}</p>}</>
              ) : <p className="mt-2 text-sm">Your joining link will appear here and be emailed to you before the meeting. Preferred platform: <b>{b.platformPref}</b>.</p>
            ) : <p className="mt-2 text-sm">The joining link is shared once your meeting is confirmed.</p>}
          </section>

          {paid.length > 0 && (
            <section className="card p-6">
              <h2 className="font-extrabold">Receipts</h2>
              <ul className="mt-2 space-y-2 text-sm">{paid.map((p) => <li key={p.id} className="flex justify-between gap-2"><span>{p.reference} · {formatMoney(p.amountCents, p.currency)}</span><Link className="font-semibold text-brand" href={`/receipt/${p.reference}${tokenQ}`}>View</Link></li>)}</ul>
            </section>
          )}

          {["CONFIRMED", "PENDING_APPROVAL", "PENDING_PAYMENT"].includes(b.status) && (
            <section className="card p-6">
              <h2 className="font-extrabold">Need to make a change?</h2>
              <p className="mt-1 text-sm">Rescheduling needs {b.service.rescheduleNoticeHours} hours&apos; notice and cancellation {b.service.cancelNoticeHours} hours&apos; notice. See the <Link href="/cancellation-policy" className="text-brand underline">cancellation &amp; refund policy</Link>.</p>
              <div className="mt-4"><RequestChange reference={b.reference} token={sp.token} pending={b.changeRequest !== "NONE" ? b.changeRequest : null} /></div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
