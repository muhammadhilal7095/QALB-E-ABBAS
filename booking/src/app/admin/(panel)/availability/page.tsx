import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { minutesToLabel } from "@/lib/tz";
import { formatInTz } from "@/lib/util";
import { PageTitle } from "@/components/AdminBits";
import AvailabilityEditor, { BlockForm, OverrideForm } from "@/components/AvailabilityEditor";
import { ApiButton } from "@/components/AdminUI";

export const metadata = { title: "Availability" };

export default async function Availability() {
  const user = await requireStaffPage();
  const isAdmin = user.role === "ADMIN";
  const [s, hours, breaks, overrides, blocked] = await Promise.all([
    getSettings(), prisma.workingHours.findMany(), prisma.breakTime.findMany(),
    prisma.dateOverride.findMany({ where: { date: { gte: new Date().toISOString().slice(0, 10) } }, orderBy: { date: "asc" } }),
    prisma.blockedSlot.findMany({ where: { endAt: { gt: new Date() } }, orderBy: { startAt: "asc" } }),
  ]);
  return (
    <>
      <PageTitle title="Availability" sub="Working hours, breaks, holidays and booking rules." />
      <AvailabilityEditor canEdit={isAdmin}
        hours={hours.map((h) => ({ weekday: h.weekday, startMinute: h.startMinute, endMinute: h.endMinute }))}
        breaks={breaks.map((b) => ({ weekday: b.weekday, startMinute: b.startMinute, endMinute: b.endMinute, label: b.label ?? "" }))}
        rules={{ timezone: s.timezone, slotStepMin: s.slotStepMin, bufferMin: s.bufferMin, minNoticeHours: s.minNoticeHours, maxDaysAhead: s.maxDaysAhead, maxPerDay: s.maxPerDay, holdMinutes: s.holdMinutes, bankHoldHours: s.bankHoldHours }} />

      <section className="card mt-6 p-5">
        <h2 className="font-extrabold">Holidays, leave &amp; custom dates</h2>
        {isAdmin && <div className="mt-4"><OverrideForm /></div>}
        <ul className="mt-4 divide-y divide-line text-sm">
          {overrides.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span><b className="text-ink">{o.date}</b> · {o.closed ? "Closed" : `Custom hours ${minutesToLabel(o.startMinute!)}–${minutesToLabel(o.endMinute!)}`}{o.note ? ` · ${o.note}` : ""}</span>
              {isAdmin && <ApiButton url="/api/admin/overrides" method="DELETE" body={{ id: o.id }} label="Remove" />}
            </li>
          ))}
          {!overrides.length && <li className="py-3 text-muted">No upcoming holidays or custom dates.</li>}
        </ul>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-extrabold">Emergency blocking</h2>
        <p className="mt-1 text-sm">Block a specific time range immediately (existing bookings are not affected — reschedule or cancel them separately).</p>
        <div className="mt-4"><BlockForm tz={s.timezone} /></div>
        <ul className="mt-4 divide-y divide-line text-sm">
          {blocked.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span><b className="text-ink">{formatInTz(b.startAt, s.timezone, { dateStyle: "medium", timeStyle: "short" })}</b> – {formatInTz(b.endAt, s.timezone, { dateStyle: undefined, timeStyle: "short" })}{b.reason ? ` · ${b.reason}` : ""}</span>
              <ApiButton url="/api/admin/blocked" method="DELETE" body={{ id: b.id }} label="Unblock" />
            </li>
          ))}
          {!blocked.length && <li className="py-3 text-muted">No blocked time ranges.</li>}
        </ul>
      </section>
    </>
  );
}
