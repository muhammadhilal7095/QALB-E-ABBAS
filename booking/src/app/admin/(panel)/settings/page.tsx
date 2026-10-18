import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth";
import { env, getSettings } from "@/lib/settings";
import { PageTitle } from "@/components/AdminBits";
import SettingsForm, { TeamForm } from "@/components/SettingsForm";
import { ApiButton } from "@/components/AdminUI";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const me = await requireStaffPage(true);
  const [s, team] = await Promise.all([getSettings(), prisma.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] } }, orderBy: { name: "asc" } })]);
  return (
    <>
      <PageTitle title="Email & System Settings" />
      <SettingsForm status={{ stripe: env.stripeConfigured(), email: env.emailConfigured(), mock: env.mockPaymentsEnabled() }} initial={{
        businessName: s.businessName, logoUrl: s.logoUrl ?? "", currency: s.currency, taxRatePercent: s.taxRatePercent, taxLabel: s.taxLabel,
        allowGuestBooking: s.allowGuestBooking, manualApproval: s.manualApproval, stripeEnabled: s.stripeEnabled, bankEnabled: s.bankEnabled,
        bankInstructions: s.bankInstructions, reminderHours: s.reminderHours, senderName: s.senderName, adminNotifyEmail: s.adminNotifyEmail,
        emailFooter: s.emailFooter, emailTemplates: (s.emailTemplates as Record<string, { subject?: string; intro?: string }>) ?? {},
        cancellationPolicy: s.cancellationPolicy, refundPolicy: s.refundPolicy,
      }} />
      <section className="card mt-6 p-5">
        <h2 className="font-extrabold">Team &amp; roles</h2>
        <p className="mt-1 text-sm">Staff can manage meetings, clients and availability blocks. Admins can also change pricing, settings, team and issue refunds.</p>
        <div className="mt-4"><TeamForm /></div>
        <ul className="mt-4 divide-y divide-line text-sm">
          {team.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span><b className="text-ink">{u.name}</b> · {u.email} · {u.role === "ADMIN" ? "Admin" : "Staff"}{!u.active && <span className="ml-2 text-xs font-semibold text-red-700">Deactivated</span>}</span>
              {u.id !== me.id && <span className="flex gap-2">
                <ApiButton url="/api/admin/users" method="PUT" body={{ id: u.id, role: u.role === "ADMIN" ? "STAFF" : "ADMIN" }} label={u.role === "ADMIN" ? "Make staff" : "Make admin"} />
                <ApiButton url="/api/admin/users" method="PUT" body={{ id: u.id, active: !u.active }} label={u.active ? "Deactivate" : "Reactivate"} confirm={u.active ? "Deactivate this account? They will be signed out." : undefined} />
              </span>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
