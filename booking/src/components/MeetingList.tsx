import Link from "next/link";
import type { Booking, MeetingService } from "@prisma/client";
import { formatInTz, formatMoney, tzAbbrev } from "@/lib/util";
import { StatusBadge } from "./SiteChrome";

export default function MeetingList({ bookings, empty }: { bookings: (Booking & { service: MeetingService })[]; empty: string }) {
  if (!bookings.length) return <p className="card p-6 text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-3">
      {bookings.map((b) => (
        <li key={b.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="font-display font-extrabold text-ink">{b.service.name}</p>
            <p className="text-sm">{formatInTz(b.startAt, b.clientTimezone, { dateStyle: "medium", timeStyle: "short" })} {tzAbbrev(b.startAt, b.clientTimezone)} · {b.durationMin} min · {formatMoney(b.totalCents, b.currency)}</p>
            <p className="mt-1 truncate text-sm text-muted">{b.title} · Ref {b.reference}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={b.status} /><StatusBadge status={b.paymentStatus} />
            <Link href={`/booking/${b.reference}`} className="btn-outline btn-sm">View</Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
