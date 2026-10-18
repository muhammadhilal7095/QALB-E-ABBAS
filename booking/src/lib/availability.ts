import { prisma, ACTIVE_STATUSES, type Db } from "./db";
import { getSettings } from "./settings";
import { addDays, dateInTz, weekdayOf, zonedToUtc } from "./tz";

export type Interval = { start: number; end: number }; // minutes after midnight

export interface AvailabilityData {
  timezone: string;
  slotStepMin: number;
  bufferMin: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  maxPerDay: number;
  workingHours: { weekday: number; startMinute: number; endMinute: number }[];
  breaks: { weekday: number | null; startMinute: number; endMinute: number }[];
  overrides: { date: string; closed: boolean; startMinute: number | null; endMinute: number | null }[];
  blocked: { startAt: Date; endAt: Date }[];
  /** Occupied ranges of other active bookings: [blockStart, blockEnd). */
  busy: { blockStart: Date; blockEnd: Date; startAt: Date }[];
}

export interface Slot { start: string; end: string }

/** Subtracts break intervals from a working window. */
export function subtractIntervals(windows: Interval[], cuts: Interval[]): Interval[] {
  let out = windows.slice();
  for (const c of cuts) {
    const next: Interval[] = [];
    for (const w of out) {
      if (c.end <= w.start || c.start >= w.end) { next.push(w); continue; }
      if (c.start > w.start) next.push({ start: w.start, end: c.start });
      if (c.end < w.end) next.push({ start: c.end, end: w.end });
    }
    out = next;
  }
  return out;
}

/** Working windows (minutes) for a business date after overrides and breaks. */
export function windowsForDate(data: AvailabilityData, date: string): Interval[] {
  const ov = data.overrides.find((o) => o.date === date);
  let windows: Interval[];
  if (ov) {
    if (ov.closed || ov.startMinute == null || ov.endMinute == null) return [];
    windows = [{ start: ov.startMinute, end: ov.endMinute }];
  } else {
    const wd = weekdayOf(date);
    windows = data.workingHours.filter((w) => w.weekday === wd).map((w) => ({ start: w.startMinute, end: w.endMinute }));
  }
  const wd = weekdayOf(date);
  const cuts = data.breaks.filter((b) => b.weekday == null || b.weekday === wd).map((b) => ({ start: b.startMinute, end: b.endMinute }));
  return subtractIntervals(windows, cuts).filter((w) => w.end > w.start);
}

/**
 * Pure slot calculation. A candidate [start, end) is free when, including the
 * buffer, [start, end + buffer) does not overlap any busy [blockStart, blockEnd)
 * — exactly the rule enforced by the database constraint.
 */
export function computeSlotsFrom(data: AvailabilityData, durationMin: number, from: Date, to: Date, now = new Date()): Slot[] {
  const tz = data.timezone;
  const earliest = now.getTime() + data.minNoticeHours * 3600_000;
  const latest = now.getTime() + data.maxDaysAhead * 86400_000;
  const slots: Slot[] = [];
  let date = addDays(dateInTz(from, tz), -1);
  const lastDate = addDays(dateInTz(to, tz), 1);
  const step = Math.max(5, data.slotStepMin);

  while (date <= lastDate) {
    const perDay = data.busy.filter((b) => dateInTz(b.startAt, tz) === date).length;
    if (perDay < data.maxPerDay) {
      for (const w of windowsForDate(data, date)) {
        for (let m = w.start; m + durationMin <= w.end; m += step) {
          const start = zonedToUtc(date, m, tz);
          const s = start.getTime();
          const e = s + durationMin * 60_000;
          const eBuf = e + data.bufferMin * 60_000;
          if (s < from.getTime() || s >= to.getTime()) continue;
          if (s < earliest || s > latest) continue;
          if (data.busy.some((b) => s < b.blockEnd.getTime() && b.blockStart.getTime() < eBuf)) continue;
          if (data.blocked.some((b) => s < b.endAt.getTime() && b.startAt.getTime() < e)) continue;
          slots.push({ start: new Date(s).toISOString(), end: new Date(e).toISOString() });
        }
      }
    }
    date = addDays(date, 1);
  }
  return slots;
}

/** Loads everything needed to compute availability for a UTC range. */
export async function loadAvailabilityData(from: Date, to: Date, opts: { db?: Db; excludeBookingId?: string; now?: Date } = {}): Promise<AvailabilityData> {
  const db = opts.db ?? prisma;
  const now = opts.now ?? new Date();
  const s = await getSettings(db);
  const pad = 2 * 86400_000;
  const lo = new Date(from.getTime() - pad), hi = new Date(to.getTime() + pad);
  const [workingHours, breaks, overrides, blocked, bookings] = await Promise.all([
    db.workingHours.findMany(),
    db.breakTime.findMany(),
    db.dateOverride.findMany({ where: { date: { gte: dateInTz(lo, s.timezone), lte: dateInTz(hi, s.timezone) } } }),
    db.blockedSlot.findMany({ where: { startAt: { lt: hi }, endAt: { gt: lo } } }),
    db.booking.findMany({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        blockStart: { lt: hi }, blockEnd: { gt: lo },
        ...(opts.excludeBookingId ? { id: { not: opts.excludeBookingId } } : {}),
      },
      select: { blockStart: true, blockEnd: true, startAt: true, status: true, holdExpiresAt: true },
    }),
  ]);
  // Expired holds no longer occupy the slot (they are cleaned up by the scheduler).
  const busy = bookings.filter((b) => !(b.status === "HELD" && b.holdExpiresAt && b.holdExpiresAt < now)
    && !(b.status === "PENDING_PAYMENT" && b.holdExpiresAt && b.holdExpiresAt < now));
  return {
    timezone: s.timezone, slotStepMin: s.slotStepMin, bufferMin: s.bufferMin, minNoticeHours: s.minNoticeHours,
    maxDaysAhead: s.maxDaysAhead, maxPerDay: s.maxPerDay, workingHours, breaks, overrides, blocked, busy,
  };
}

export async function getSlots(durationMin: number, from: Date, to: Date, opts: { db?: Db; excludeBookingId?: string; now?: Date } = {}): Promise<Slot[]> {
  const data = await loadAvailabilityData(from, to, opts);
  return computeSlotsFrom(data, durationMin, from, to, opts.now);
}

/** True when `start` is one of the valid open slots for this duration. */
export async function isSlotAvailable(durationMin: number, start: Date, opts: { db?: Db; excludeBookingId?: string; now?: Date } = {}): Promise<boolean> {
  const slots = await getSlots(durationMin, new Date(start.getTime() - 60_000), new Date(start.getTime() + 60_000), opts);
  return slots.some((s) => new Date(s.start).getTime() === start.getTime());
}
