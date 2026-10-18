import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth";
import { formatMoney } from "@/lib/util";
import { PageTitle } from "@/components/AdminBits";
import { ApiButton, DeleteService, ServiceEditor } from "@/components/AdminUI";
import { CouponForm } from "@/components/SettingsForm";

export const metadata = { title: "Services & Pricing" };

export default async function Services() {
  await requireStaffPage(true);
  const [services, team, coupons] = await Promise.all([
    prisma.meetingService.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { assignedTo: true, _count: { select: { bookings: true } } } }),
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] }, active: true }, select: { id: true, name: true } }),
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <>
      <PageTitle title="Services & Pricing" sub="Meeting types clients can book. Prices are charged in the currency shown."><ServiceEditor team={team} /></PageTitle>
      <div className="card overflow-x-auto">
        <table className="table-x min-w-[900px]">
          <thead><tr><th>Meeting type</th><th>Duration</th><th>Price</th><th>Payment</th><th>Notice (cancel / reschedule)</th><th>Assigned</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td><b>{s.name}</b><span className="block max-w-sm truncate text-xs text-muted">/{s.slug} · {s._count.bookings} bookings</span></td>
                <td>{s.durationMin} min</td>
                <td className="font-semibold">{formatMoney(s.priceCents, s.currency)}</td>
                <td className="text-xs">{s.paymentRequirement === "DEPOSIT" ? `${s.depositPercent}% deposit` : s.paymentRequirement === "NONE" ? "Free" : "Full"}</td>
                <td className="text-xs">{s.cancelNoticeHours}h / {s.rescheduleNoticeHours}h</td>
                <td className="text-xs">{s.assignedTo?.name ?? "—"}</td>
                <td>{s.active ? <span className="text-xs font-semibold text-green-700">Active</span> : <span className="text-xs font-semibold text-muted">Inactive</span>}</td>
                <td className="whitespace-nowrap">
                  <ServiceEditor team={team} initial={{ id: s.id, name: s.name, slug: s.slug, description: s.description, durationMin: s.durationMin, price: s.priceCents / 100, currency: s.currency, active: s.active, isCustom: s.isCustom, sortOrder: s.sortOrder, paymentRequirement: s.paymentRequirement, depositPercent: s.depositPercent, cancelNoticeHours: s.cancelNoticeHours, rescheduleNoticeHours: s.rescheduleNoticeHours, policyNote: s.policyNote ?? "", assignedToId: s.assignedToId ?? "" }} />
                  <DeleteService id={s.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 mt-10 text-lg font-extrabold">Coupons</h2>
      <div className="card p-5"><CouponForm /></div>
      <div className="card mt-4 overflow-x-auto">
        <table className="table-x min-w-[640px]">
          <thead><tr><th>Code</th><th>Discount</th><th>Used</th><th>Valid until</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="font-mono font-bold">{c.code}</td>
                <td>{c.percentOff ? `${c.percentOff}%` : formatMoney(c.amountOffCents ?? 0, "GBP")}</td>
                <td>{c.redemptions}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}</td>
                <td>{c.validTo ? c.validTo.toISOString().slice(0, 10) : "—"}</td>
                <td>{c.active ? "Active" : "Disabled"}</td>
                <td><ApiButton url="/api/admin/coupons" method="PUT" body={{ id: c.id, active: !c.active }} label={c.active ? "Disable" : "Enable"} /></td>
              </tr>
            ))}
            {!coupons.length && <tr><td colSpan={6} className="py-4 text-center text-muted">No coupons yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
