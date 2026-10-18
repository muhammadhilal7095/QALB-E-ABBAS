import { describe, it, expect } from "vitest";
import { computeSlotsFrom, subtractIntervals, type AvailabilityData } from "@/lib/availability";
import { zonedToUtc, dateInTz, minuteInTz } from "@/lib/tz";

const base = (over: Partial<AvailabilityData> = {}): AvailabilityData => ({
  timezone: "Europe/London", slotStepMin: 30, bufferMin: 15, minNoticeHours: 0, maxDaysAhead: 365, maxPerDay: 10,
  workingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 9 * 60, endMinute: 12 * 60 })),
  breaks: [], overrides: [], blocked: [], busy: [], ...over,
});
const day = (date: string) => [zonedToUtc(date, 0, "Europe/London"), zonedToUtc(date, 24 * 60, "Europe/London")] as const;
const NOW = new Date("2026-01-01T00:00:00Z");

describe("time zones", () => {
  it("converts London wall time to UTC across daylight saving", () => {
    expect(zonedToUtc("2026-01-15", 9 * 60, "Europe/London").toISOString()).toBe("2026-01-15T09:00:00.000Z"); // GMT
    expect(zonedToUtc("2026-07-15", 9 * 60, "Europe/London").toISOString()).toBe("2026-07-15T08:00:00.000Z"); // BST
    expect(zonedToUtc("2026-07-15", 9 * 60, "Asia/Karachi").toISOString()).toBe("2026-07-15T04:00:00.000Z");
    expect(zonedToUtc("2026-07-15", 9 * 60, "America/New_York").toISOString()).toBe("2026-07-15T13:00:00.000Z");
  });
  it("round-trips dates and minutes", () => {
    const d = zonedToUtc("2026-03-29", 10 * 60 + 30, "Europe/London"); // DST change day
    expect(dateInTz(d, "Europe/London")).toBe("2026-03-29");
    expect(minuteInTz(d, "Europe/London")).toBe(630);
  });
});

describe("availability", () => {
  it("generates slots inside working hours", () => {
    const [from, to] = day("2026-01-15");
    const slots = computeSlotsFrom(base(), 60, from, to, NOW);
    expect(slots.map((s) => s.start)).toEqual(["2026-01-15T09:00:00.000Z", "2026-01-15T09:30:00.000Z", "2026-01-15T10:00:00.000Z", "2026-01-15T10:30:00.000Z", "2026-01-15T11:00:00.000Z"]);
  });
  it("removes breaks", () => {
    expect(subtractIntervals([{ start: 540, end: 1020 }], [{ start: 780, end: 840 }])).toEqual([{ start: 540, end: 780 }, { start: 840, end: 1020 }]);
  });
  it("respects existing bookings plus the buffer on both sides", () => {
    const [from, to] = day("2026-01-15");
    const busyStart = new Date("2026-01-15T10:00:00Z");
    const data = base({ busy: [{ startAt: busyStart, blockStart: busyStart, blockEnd: new Date("2026-01-15T10:45:00Z") }] }); // 30-min meeting + 15 buffer
    const starts = computeSlotsFrom(data, 30, from, to, NOW).map((s) => s.start.slice(11, 16));
    // 09:30 slot would end 10:00 + 15 buffer = 10:15 → overlaps; 10:30 starts inside buffer → blocked.
    expect(starts).toEqual(["09:00", "11:00", "11:30"]);
  });
  it("closes holidays and applies custom hours", () => {
    const [from, to] = day("2026-01-15");
    expect(computeSlotsFrom(base({ overrides: [{ date: "2026-01-15", closed: true, startMinute: null, endMinute: null }] }), 30, from, to, NOW)).toHaveLength(0);
    const custom = computeSlotsFrom(base({ overrides: [{ date: "2026-01-15", closed: false, startMinute: 14 * 60, endMinute: 15 * 60 }] }), 30, from, to, NOW);
    expect(custom.map((s) => s.start.slice(11, 16))).toEqual(["14:00", "14:30"]);
  });
  it("enforces minimum notice, maximum horizon and daily cap", () => {
    const [from, to] = day("2026-01-15");
    const now = new Date("2026-01-15T08:00:00Z");
    expect(computeSlotsFrom(base({ minNoticeHours: 2 }), 30, from, to, now)[0].start.slice(11, 16)).toBe("10:00");
    expect(computeSlotsFrom(base({ maxDaysAhead: 5 }), 30, from, to, new Date("2026-01-01T00:00:00Z"))).toHaveLength(0);
    const busy = [new Date("2026-01-15T09:00:00Z")].map((d) => ({ startAt: d, blockStart: d, blockEnd: new Date(d.getTime() + 45 * 60_000) }));
    expect(computeSlotsFrom(base({ maxPerDay: 1, busy }), 30, from, to, NOW)).toHaveLength(0);
  });
  it("respects emergency blocked slots", () => {
    const [from, to] = day("2026-01-15");
    const slots = computeSlotsFrom(base({ blocked: [{ startAt: new Date("2026-01-15T09:00:00Z"), endAt: new Date("2026-01-15T11:00:00Z") }] }), 60, from, to, NOW);
    expect(slots.map((s) => s.start.slice(11, 16))).toEqual(["11:00"]);
  });
});
