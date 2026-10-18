import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { availableGateways } from "@/lib/payments";
import { formatInTz, formatMoney, tzAbbrev } from "@/lib/util";
import { HoldCountdown, PayOptions } from "@/components/Checkout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Secure Checkout" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const b = await prisma.booking.findUnique({ where: { reference: sp.booking ?? "" }, include: { service: true, client: true } });
  const user = await getCurrentUser();
  if (!b || !((sp.token && sp.token === b.manageToken) || (user && b.client.userId === user.id))) notFound();
  if (b.status !== "HELD" || !b.holdExpiresAt || b.holdExpiresAt < new Date()) redirect(`/booking/${b.reference}?token=${b.manageToken}`);
  const gateways = await availableGateways();
  const tz = b.clientTimezone;
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold text-ink">{v}</dd></div>;

  return (
    <div className="container-x py-10">
      <p className="eyebrow">Step 6 · Secure checkout</p>
      <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Complete your payment</h1>
      {sp.failed && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">Your payment didn&apos;t go through. You can try again below.</p>}
      {sp.cancelled && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">Payment was cancelled — your slot is still reserved for now.</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="card p-6">
          <HoldCountdown expiresAt={b.holdExpiresAt.toISOString()} />
          <h2 className="mt-6 text-lg font-extrabold">Choose how to pay</h2>
          <div className="mt-4"><PayOptions reference={b.reference} token={b.manageToken} gateways={gateways} dueLabel={formatMoney(b.dueNowCents, b.currency)} /></div>
        </section>
        <aside className="card h-fit p-6">
          <h2 className="font-extrabold">Booking summary</h2>
          <dl className="mt-3 divide-y divide-line text-sm">
            {row("Reference", b.reference)}
            {row("Meeting", b.service.name)}
            {row("Purpose", <span className="line-clamp-2">{b.purpose}</span>)}
            {row("Date", formatInTz(b.startAt, tz, { dateStyle: "full", timeStyle: undefined }))}
            {row("Time", `${formatInTz(b.startAt, tz, { dateStyle: undefined, timeStyle: "short" })} – ${formatInTz(b.endAt, tz, { dateStyle: undefined, timeStyle: "short" })} ${tzAbbrev(b.startAt, tz)}`)}
            {row("Duration", `${b.durationMin} minutes`)}
            {row("Meeting fee", formatMoney(b.priceCents, b.currency))}
            {b.discountCents > 0 && row("Discount", `−${formatMoney(b.discountCents, b.currency)}`)}
            {b.taxCents > 0 && row("Tax", formatMoney(b.taxCents, b.currency))}
            {row("Total", formatMoney(b.totalCents, b.currency))}
            {b.dueNowCents !== b.totalCents && row("Due now (deposit)", formatMoney(b.dueNowCents, b.currency))}
            {row("Payment status", b.paymentStatus === "FAILED" ? "Failed — please retry" : "Awaiting payment")}
          </dl>
        </aside>
      </div>
    </div>
  );
}
