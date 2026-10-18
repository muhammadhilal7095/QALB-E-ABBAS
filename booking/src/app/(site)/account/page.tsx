import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import AccountNav from "@/components/AccountNav";
import MeetingList from "@/components/MeetingList";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Account" };

export default async function AccountHome() {
  const user = await requireUser(["CLIENT"]);
  const now = new Date();
  const where = { client: { userId: user.id } };
  const pastWhere = { ...where, OR: [{ startAt: { lt: now } }, { status: { in: ["COMPLETED" as const, "CANCELLED" as const, "REJECTED" as const, "EXPIRED" as const] } }] };
  const [upcoming, previous, previousCount, paidAgg] = await Promise.all([
    prisma.booking.findMany({ where: { ...where, startAt: { gte: now }, status: { in: ["CONFIRMED", "PENDING_APPROVAL", "PENDING_PAYMENT", "HELD"] } }, include: { service: true }, orderBy: { startAt: "asc" } }),
    prisma.booking.findMany({ where: pastWhere, include: { service: true }, orderBy: { startAt: "desc" }, take: 5 }),
    prisma.booking.count({ where: pastWhere }),
    prisma.booking.aggregate({ where, _sum: { paidCents: true, refundedCents: true }, _count: true }),
  ]);
  return (
    <div className="container-x py-10">
      <AccountNav active="/account" name={user.name} />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[["Upcoming meetings", upcoming.length], ["Total bookings", paidAgg._count], ["Previous meetings", previousCount]].map(([k, v]) => (
          <div key={k as string} className="card p-5"><p className="text-sm text-muted">{k}</p><p className="mt-1 font-display text-3xl font-extrabold text-ink">{v}</p></div>
        ))}
      </div>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold">Upcoming meetings</h2><Link href="/#services" className="btn-gold btn-sm">Book a meeting</Link></div>
      <MeetingList bookings={upcoming} empty="You have no upcoming meetings." />
      <h2 className="mb-3 mt-10 text-lg font-extrabold">Previous meetings</h2>
      <MeetingList bookings={previous} empty="No previous meetings yet." />
      {previousCount > 5 && <Link href="/account/meetings" className="mt-3 inline-block text-sm font-semibold text-brand">See all meetings →</Link>}
    </div>
  );
}
