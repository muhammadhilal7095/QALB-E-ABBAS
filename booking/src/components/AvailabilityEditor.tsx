"use client";

import { useMemo, useState } from "react";
import { api } from "./AdminUI";

type Range = { weekday: number; startMinute: number; endMinute: number };
type Br = { weekday: number | null; startMinute: number; endMinute: number; label?: string };
type Rules = { timezone: string; slotStepMin: number; bufferMin: number; minNoticeHours: number; maxDaysAhead: number; maxPerDay: number; holdMinutes: number; bankHoldHours: number };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const toLabel = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };

export default function AvailabilityEditor({ hours, breaks, rules, canEdit }: { hours: Range[]; breaks: Br[]; rules: Rules; canEdit: boolean }) {
  const [h, setH] = useState(hours);
  const [b, setB] = useState(breaks);
  const [r, setR] = useState(rules);
  const [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const zones = useMemo(() => { try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone"); } catch { return [rules.timezone]; } }, [rules.timezone]);

  async function save() {
    setBusy(true); setErr(""); setMsg("");
    try { await api("/api/admin/availability", "PUT", { workingHours: h, breaks: b, rules: r }); setMsg("Availability saved."); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  const num = (k: keyof Rules, label: string, hint: string, min = 0) => (
    <div><label className="label text-xs">{label}</label><input type="number" min={min} className="input" disabled={!canEdit} value={r[k] as number} onChange={(e) => setR({ ...r, [k]: Number(e.target.value) })} /><p className="hint">{hint}</p></div>
  );

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="font-extrabold">Weekly working hours</h2>
        <p className="mt-1 text-sm">Times are in the business time zone ({r.timezone}). Add several ranges to a day for split shifts.</p>
        <div className="mt-4 divide-y divide-line">
          {ORDER.map((wd) => {
            const ranges = h.map((x, i) => ({ ...x, i })).filter((x) => x.weekday === wd);
            return (
              <div key={wd} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-28 font-semibold text-ink">{DAYS[wd]}</span>
                {ranges.length === 0 && <span className="text-sm text-muted">Closed</span>}
                {ranges.map((x) => (
                  <span key={x.i} className="flex items-center gap-1.5">
                    <input type="time" className="input w-28 py-1.5" disabled={!canEdit} value={toLabel(x.startMinute)} onChange={(e) => setH(h.map((y, j) => j === x.i ? { ...y, startMinute: toMin(e.target.value) } : y))} aria-label={`${DAYS[wd]} start`} />
                    –
                    <input type="time" className="input w-28 py-1.5" disabled={!canEdit} value={toLabel(x.endMinute)} onChange={(e) => setH(h.map((y, j) => j === x.i ? { ...y, endMinute: toMin(e.target.value) } : y))} aria-label={`${DAYS[wd]} end`} />
                    {canEdit && <button type="button" className="text-sm text-red-700" onClick={() => setH(h.filter((_, j) => j !== x.i))} aria-label="Remove range">✕</button>}
                  </span>
                ))}
                {canEdit && <button type="button" className="btn-ghost btn-sm" onClick={() => setH([...h, { weekday: wd, startMinute: 540, endMinute: 1020 }])}>+ Add hours</button>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-extrabold">Breaks</h2>
        <div className="mt-3 space-y-2">
          {b.map((x, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select className="input w-40 py-1.5" disabled={!canEdit} value={x.weekday ?? ""} onChange={(e) => setB(b.map((y, j) => j === i ? { ...y, weekday: e.target.value === "" ? null : Number(e.target.value) } : y))} aria-label="Day">
                <option value="">Every day</option>{ORDER.map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}
              </select>
              <input type="time" className="input w-28 py-1.5" disabled={!canEdit} value={toLabel(x.startMinute)} onChange={(e) => setB(b.map((y, j) => j === i ? { ...y, startMinute: toMin(e.target.value) } : y))} aria-label="Break start" />–
              <input type="time" className="input w-28 py-1.5" disabled={!canEdit} value={toLabel(x.endMinute)} onChange={(e) => setB(b.map((y, j) => j === i ? { ...y, endMinute: toMin(e.target.value) } : y))} aria-label="Break end" />
              <input className="input w-36 py-1.5" disabled={!canEdit} placeholder="Label" value={x.label ?? ""} onChange={(e) => setB(b.map((y, j) => j === i ? { ...y, label: e.target.value } : y))} aria-label="Label" />
              {canEdit && <button type="button" className="text-sm text-red-700" onClick={() => setB(b.filter((_, j) => j !== i))} aria-label="Remove break">✕</button>}
            </div>
          ))}
          {canEdit && <button type="button" className="btn-ghost btn-sm" onClick={() => setB([...b, { weekday: null, startMinute: 780, endMinute: 840, label: "Break" }])}>+ Add break</button>}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-extrabold">Booking rules</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="label text-xs">Business time zone</label><select className="input" disabled={!canEdit} value={r.timezone} onChange={(e) => setR({ ...r, timezone: e.target.value })}>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</select></div>
          <div><label className="label text-xs">Slot interval</label><select className="input" disabled={!canEdit} value={r.slotStepMin} onChange={(e) => setR({ ...r, slotStepMin: Number(e.target.value) })}>{[5, 10, 15, 20, 30, 60].map((n) => <option key={n} value={n}>Every {n} minutes</option>)}</select><p className="hint">How often start times are offered.</p></div>
          {num("bufferMin", "Buffer between meetings (min)", "Free time kept after each meeting.")}
          {num("minNoticeHours", "Minimum advance booking (hours)", "No bookings sooner than this.")}
          {num("maxDaysAhead", "Maximum booking period (days)", "How far ahead clients can book.", 1)}
          {num("maxPerDay", "Maximum appointments per day", "Days at the limit show as full.", 1)}
          {num("holdMinutes", "Checkout hold (minutes)", "Slot reserved while the client pays.", 10)}
          {num("bankHoldHours", "Bank transfer hold (hours)", "Time allowed to receive a transfer.", 1)}
        </div>
      </section>

      {canEdit ? (
        <div className="flex items-center gap-3"><button className="btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save availability"}</button>{msg && <span className="text-sm text-green-700">{msg}</span>}{err && <span className="err">{err}</span>}</div>
      ) : <p className="text-sm text-muted">Only admins can change working hours and rules.</p>}
    </div>
  );
}

export function OverrideForm() {
  const [f, setF] = useState({ date: "", toDate: "", closed: true, start: "10:00", end: "14:00", note: "" });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  return (
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      try { await api("/api/admin/overrides", "POST", { date: f.date, toDate: f.toDate || undefined, closed: f.closed, startMinute: f.closed ? null : toMin(f.start), endMinute: f.closed ? null : toMin(f.end), note: f.note }); window.location.reload(); }
      catch (x) { setErr((x as Error).message); setBusy(false); }
    }}>
      <div><label className="label text-xs">From</label><input type="date" required className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
      <div><label className="label text-xs">To (optional)</label><input type="date" className="input" value={f.toDate} onChange={(e) => setF({ ...f, toDate: e.target.value })} /></div>
      <div><label className="label text-xs">Type</label><select className="input" value={f.closed ? "closed" : "custom"} onChange={(e) => setF({ ...f, closed: e.target.value === "closed" })}><option value="closed">Closed (holiday / leave)</option><option value="custom">Custom hours</option></select></div>
      {!f.closed ? <div className="flex gap-1"><div><label className="label text-xs">Start</label><input type="time" className="input" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div><div><label className="label text-xs">End</label><input type="time" className="input" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div></div> : <div />}
      <div><label className="label text-xs">Note</label><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Eid holiday" /></div>
      <div className="self-end"><button className="btn-primary w-full" disabled={busy}>Add</button></div>
      {err && <p className="err sm:col-span-2 lg:col-span-6">{err}</p>}
    </form>
  );
}

export function BlockForm({ tz }: { tz: string }) {
  const [f, setF] = useState({ date: "", start: "09:00", end: "10:00", reason: "" });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  return (
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      try {
        const conv = (time: string) => { // wall time in the business zone → UTC ISO
          const guess = Date.UTC(+f.date.slice(0, 4), +f.date.slice(5, 7) - 1, +f.date.slice(8, 10), +time.slice(0, 2), +time.slice(3, 5));
          const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
          const off = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - guess;
          return new Date(guess - off).toISOString();
        };
        await api("/api/admin/blocked", "POST", { startAt: conv(f.start), endAt: conv(f.end), reason: f.reason }); window.location.reload();
      } catch (x) { setErr((x as Error).message); setBusy(false); }
    }}>
      <div><label className="label text-xs">Date ({tz})</label><input type="date" required className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
      <div><label className="label text-xs">From</label><input type="time" className="input" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div>
      <div><label className="label text-xs">To</label><input type="time" className="input" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div>
      <div><label className="label text-xs">Reason</label><input className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Emergency" /></div>
      <div className="self-end"><button className="btn-danger w-full" disabled={busy}>Block time</button></div>
      {err && <p className="err sm:col-span-2 lg:col-span-5">{err}</p>}
    </form>
  );
}
