"use client";

import { useState } from "react";

export async function api(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<unknown>, reload = true, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true); setErr("");
    try { await fn(); if (reload) window.location.reload(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return { busy, err, run };
}

/** Status actions on a booking. */
export function BookingActions({ id, status, paid, due, isAdmin, hasRequest }: { id: string; status: string; paid: number; due: number; isAdmin: boolean; hasRequest: boolean }) {
  const { busy, err, run } = useAction();
  const act = (action: string, extra: Record<string, unknown> = {}, msg?: string) => run(() => api(`/api/admin/bookings/${id}`, "POST", { action, ...extra }), true, msg);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "PENDING_APPROVAL" && <button className="btn-primary btn-sm" disabled={busy} onClick={() => act("approve")}>Approve</button>}
        {["PENDING_APPROVAL", "PENDING_PAYMENT", "HELD"].includes(status) && <button className="btn-ghost btn-sm" disabled={busy} onClick={() => { const reason = prompt("Reason for rejection (optional):") ?? undefined; act("reject", { reason }); }}>Reject</button>}
        {["PENDING_PAYMENT", "HELD"].includes(status) && <button className="btn-ghost btn-sm" disabled={busy} onClick={() => act("confirm", {}, due > paid ? "Confirm without payment received?" : undefined)}>Confirm without payment</button>}
        {isAdmin && due > paid && ["PENDING_PAYMENT", "HELD", "EXPIRED", "CONFIRMED", "PENDING_APPROVAL"].includes(status) && <button className="btn-primary btn-sm" disabled={busy} onClick={() => act("markPaid", {}, "Record the outstanding amount as received (e.g. bank transfer)?")}>Mark payment received</button>}
        {status === "CONFIRMED" && <button className="btn-primary btn-sm" disabled={busy} onClick={() => act("complete")}>Mark completed</button>}
        {["CONFIRMED", "PENDING_APPROVAL", "PENDING_PAYMENT", "HELD"].includes(status) && <button className="btn-danger btn-sm" disabled={busy} onClick={() => { const reason = prompt("Cancellation reason (sent to client):"); if (reason !== null) act("cancel", { reason }); }}>Cancel meeting</button>}
        {hasRequest && <button className="btn-ghost btn-sm" disabled={busy} onClick={() => act("clearRequest")}>Mark request handled</button>}
      </div>
      {err && <p className="err mt-2">{err}</p>}
    </div>
  );
}

export function RescheduleForm({ id, tz }: { id: string; tz: string }) {
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ start: string }[] | null>(null);
  const [override, setOverride] = useState(false);
  const [time, setTime] = useState("");
  const { busy, err, run } = useAction();
  async function load(d: string) {
    setDate(d); setSlots(null);
    if (!d) return;
    const from = new Date(`${d}T00:00:00Z`).getTime() - 86400_000, to = from + 3 * 86400_000;
    const j = await api(`/api/admin/slots?bookingId=${id}&from=${new Date(from).toISOString()}&to=${new Date(to).toISOString()}`, "GET");
    setSlots((j.slots as { start: string }[]).filter((s) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(s.start)) === d));
  }
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  return (
    <div className="space-y-3">
      <div><label className="label" htmlFor="rd">New date ({tz})</label><input id="rd" type="date" className="input" value={date} onChange={(e) => load(e.target.value)} /></div>
      {slots && !override && (slots.length ? <div className="flex flex-wrap gap-2">{slots.map((s) => <button key={s.start} type="button" disabled={busy} className="btn-ghost btn-sm" onClick={() => run(() => api(`/api/admin/bookings/${id}`, "POST", { action: "reschedule", startAt: s.start }), true, `Move meeting to ${fmt(s.start)}? The client will be emailed.`)}>{fmt(s.start)}</button>)}</div> : <p className="text-sm text-muted">No free slots that day.</p>)}
      <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Admin override: choose any time (still blocked if it overlaps another meeting)</label>
      {override && date && (
        <div className="flex gap-2"><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          <button className="btn-primary btn-sm" disabled={!time || busy} onClick={() => run(() => api(`/api/admin/bookings/${id}`, "POST", { action: "reschedule", localDate: date, localTime: time, override: true }), true, `Move meeting to ${date} ${time} (${tz})?`)}>Move</button></div>
      )}
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export function MeetingLinkForm({ id, initial }: { id: string; initial: { platform: string; url: string; instructions: string } }) {
  const [f, setF] = useState(initial);
  const [notify, setNotify] = useState(true);
  const { busy, err, run } = useAction();
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => api(`/api/admin/bookings/${id}`, "POST", { action: "link", ...f, notify })); }}>
      <select className="input" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} aria-label="Platform">
        {[["GOOGLE_MEET", "Google Meet"], ["ZOOM", "Zoom"], ["TEAMS", "Microsoft Teams"], ["CUSTOM", "Custom link"], ["PHONE", "Phone call"], ["IN_PERSON", "In person"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input className="input" placeholder="https://meet.google.com/…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} aria-label="Meeting URL" />
      <textarea className="input" rows={2} placeholder="Joining instructions (optional)" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} aria-label="Instructions" />
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email the updated details to the client</label>
      <button className="btn-primary btn-sm" disabled={busy}>Save link</button>
      {err && <p className="err">{err}</p>}
    </form>
  );
}

export function AssignForm({ id, current, team }: { id: string; current: string | null; team: { id: string; name: string }[] }) {
  const { busy, err, run } = useAction();
  return (
    <div>
      <select className="input" disabled={busy} value={current ?? ""} aria-label="Assigned team member" onChange={(e) => run(() => api(`/api/admin/bookings/${id}`, "POST", { action: "assign", userId: e.target.value || null }))}>
        <option value="">Unassigned</option>
        {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export function NoteForm({ id }: { id: string }) {
  const [body, setBody] = useState("");
  const { busy, err, run } = useAction();
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => api(`/api/admin/bookings/${id}`, "POST", { action: "note", body })); }}>
      <textarea className="input" rows={3} placeholder="Internal note (not visible to the client)" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Internal note" />
      <button className="btn-primary btn-sm" disabled={busy || !body.trim()}>Add note</button>
      {err && <p className="err">{err}</p>}
    </form>
  );
}

export function RefundForm({ paymentId, max, currency }: { paymentId: string; max: number; currency: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState((max / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const { busy, err, run } = useAction();
  if (!open) return <button className="btn-ghost btn-sm" onClick={() => setOpen(true)}>Refund…</button>;
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-line p-3">
      <div className="flex gap-2"><span className="self-center text-sm">{currency}</span><input className="input" type="number" step="0.01" min="0.01" max={(max / 100).toFixed(2)} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Refund amount" /></div>
      <input className="input" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Refund reason" />
      <div className="flex gap-2">
        <button className="btn-danger btn-sm" disabled={busy} onClick={() => run(() => api(`/api/admin/payments/${paymentId}/refund`, "POST", { amount: Number(amount), reason }), true, `Refund ${currency} ${amount}? This cannot be undone.`)}>Issue refund</button>
        <button className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

type ServiceForm = { id?: string; name: string; slug: string; description: string; durationMin: number; price: number; currency: string; active: boolean; isCustom: boolean; sortOrder: number; paymentRequirement: string; depositPercent: number; cancelNoticeHours: number; rescheduleNoticeHours: number; policyNote: string; assignedToId: string };

export function ServiceEditor({ initial, team }: { initial?: ServiceForm; team: { id: string; name: string }[] }) {
  const blank: ServiceForm = { name: "", slug: "", description: "", durationMin: 30, price: 30, currency: "GBP", active: true, isCustom: false, sortOrder: 0, paymentRequirement: "FULL", depositPercent: 50, cancelNoticeHours: 24, rescheduleNoticeHours: 24, policyNote: "", assignedToId: "" };
  const [f, setF] = useState<ServiceForm>(initial ?? blank);
  const [open, setOpen] = useState(false);
  const { busy, err, run } = useAction();
  const set = (k: keyof ServiceForm, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  if (!open) return <button className={initial ? "btn-ghost btn-sm" : "btn-primary"} onClick={() => setOpen(true)}>{initial ? "Edit" : "Add meeting type"}</button>;
  const num = (k: keyof ServiceForm, label: string, props: Record<string, unknown> = {}) => <div><label className="label text-xs">{label}</label><input className="input" type="number" value={f[k] as number} onChange={(e) => set(k, Number(e.target.value))} {...props} /></div>;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/50 p-4" role="dialog" aria-modal="true" aria-label="Meeting type">
      <form className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6" onSubmit={(e) => { e.preventDefault(); run(() => api("/api/admin/services", initial ? "PUT" : "POST", f)); }}>
        <h2 className="text-lg font-extrabold">{initial ? "Edit meeting type" : "New meeting type"}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="label text-xs">Name</label><input className="input" value={f.name} onChange={(e) => { set("name", e.target.value); if (!initial) set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} /></div>
          <div><label className="label text-xs">URL slug</label><input className="input" value={f.slug} onChange={(e) => set("slug", e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="label text-xs">Description</label><textarea className="input" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div><label className="label text-xs">Duration</label><select className="input" value={f.durationMin} onChange={(e) => set("durationMin", Number(e.target.value))}>{[15, 30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d} minutes</option>)}</select></div>
          <div className="grid grid-cols-[1fr_90px] gap-2">{num("price", "Price", { step: "0.01", min: 0 })}<div><label className="label text-xs">Currency</label><input className="input" value={f.currency} maxLength={3} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></div></div>
          <div><label className="label text-xs">Payment requirement</label><select className="input" value={f.paymentRequirement} onChange={(e) => set("paymentRequirement", e.target.value)}><option value="FULL">Full payment before confirmation</option><option value="DEPOSIT">Deposit / partial payment</option><option value="NONE">No payment (free)</option></select></div>
          {f.paymentRequirement === "DEPOSIT" ? num("depositPercent", "Deposit %", { min: 1, max: 100 }) : <div />}
          {num("cancelNoticeHours", "Cancellation notice (hours)", { min: 0 })}
          {num("rescheduleNoticeHours", "Reschedule notice (hours)", { min: 0 })}
          <div><label className="label text-xs">Assigned team member</label><select className="input" value={f.assignedToId} onChange={(e) => set("assignedToId", e.target.value)}><option value="">— None —</option>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          {num("sortOrder", "Display order", { min: 0 })}
          <div className="sm:col-span-2"><label className="label text-xs">Policy note (optional)</label><input className="input" value={f.policyNote} onChange={(e) => set("policyNote", e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Active (bookable)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isCustom} onChange={(e) => set("isCustom", e.target.checked)} /> Custom meeting</label>
        </div>
        {err && <p className="err mt-3">{err}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
      </form>
    </div>
  );
}

export function DeleteService({ id }: { id: string }) {
  const { busy, err, run } = useAction();
  return <><button className="btn-ghost btn-sm text-red-700" disabled={busy} onClick={() => run(async () => { const r = await api("/api/admin/services", "DELETE", { id }); if (r.message) alert(r.message); }, true, "Delete this meeting type?")}>Delete</button>{err && <p className="err">{err}</p>}</>;
}

/** Generic toggle/delete button calling an admin endpoint. */
export function ApiButton({ url, method, body, label, confirm: c, className = "btn-ghost btn-sm" }: { url: string; method: string; body?: unknown; label: string; confirm?: string; className?: string }) {
  const { busy, err, run } = useAction();
  return <span><button className={className} disabled={busy} onClick={() => run(() => api(url, method, body), true, c)}>{label}</button>{err && <span className="err ml-2">{err}</span>}</span>;
}
