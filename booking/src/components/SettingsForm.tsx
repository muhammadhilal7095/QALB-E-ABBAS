"use client";

import { useState } from "react";
import { api } from "./AdminUI";

type Settings = {
  businessName: string; logoUrl: string; currency: string; taxRatePercent: number; taxLabel: string; allowGuestBooking: boolean; manualApproval: boolean;
  stripeEnabled: boolean; bankEnabled: boolean; bankInstructions: string; reminderHours: number[]; senderName: string; adminNotifyEmail: string;
  emailFooter: string; emailTemplates: Record<string, { subject?: string; intro?: string }>; cancellationPolicy: string; refundPolicy: string;
};

const TEMPLATES: [string, string][] = [
  ["booking_received", "Booking request received"], ["payment_success", "Payment successful"], ["booking_confirmed", "Booking confirmed"],
  ["payment_failed", "Payment failed"], ["reminder", "Appointment reminder"], ["rescheduled", "Meeting rescheduled"], ["cancelled", "Meeting cancelled"],
  ["refund_processed", "Refund processed"], ["bank_instructions", "Bank transfer instructions"], ["pending_approval", "Awaiting approval"],
];

export default function SettingsForm({ initial, status }: { initial: Settings; status: { stripe: boolean; email: boolean; mock: boolean } }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));
  const tpl = (key: string, field: "subject" | "intro", v: string) => set("emailTemplates", { ...s.emailTemplates, [key]: { ...s.emailTemplates[key], [field]: v || undefined } });
  const check = (k: keyof Settings, label: string, hint?: string) => (
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-brand" checked={s[k] as boolean} onChange={(e) => set(k, e.target.checked as never)} /><span><b className="text-ink">{label}</b>{hint && <span className="block text-muted">{hint}</span>}</span></label>
  );
  async function save() {
    setBusy(true); setErr(""); setMsg("");
    try { await api("/api/admin/settings", "PUT", s); setMsg("Settings saved."); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="font-extrabold">Integration status</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <li className={`rounded-xl p-3 ${status.stripe ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}><b>Stripe:</b> {status.stripe ? "Connected" : "Not configured — add STRIPE_SECRET_KEY & STRIPE_WEBHOOK_SECRET"}</li>
          <li className={`rounded-xl p-3 ${status.email ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}><b>Email:</b> {status.email ? "Sending via Resend" : "Not configured — emails are logged only (see Email log)"}</li>
          <li className={`rounded-xl p-3 ${status.mock ? "bg-blue-50 text-blue-900" : "bg-soft"}`}><b>Test payments:</b> {status.mock ? "Enabled (development only)" : "Disabled"}</li>
        </ul>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-extrabold sm:col-span-2">General &amp; branding</h2>
        <div><label className="label text-xs">Business name</label><input className="input" value={s.businessName} onChange={(e) => set("businessName", e.target.value)} /></div>
        <div><label className="label text-xs">Logo URL for emails (optional)</label><input className="input" value={s.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://qalbeabbas.com/assets/img/logo.png" /></div>
        <div className="space-y-3 sm:col-span-2">
          {check("allowGuestBooking", "Allow guest booking", "Clients can book without creating an account.")}
          {check("manualApproval", "Manual approval", "Paid bookings wait for a team member to approve before they are confirmed.")}
        </div>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-extrabold sm:col-span-2">Payments &amp; tax</h2>
        <div className="space-y-3 sm:col-span-2">
          {check("stripeEnabled", "Card payments (Stripe)", "Requires Stripe keys in the server environment.")}
          {check("bankEnabled", "Bank transfer / manual payment", "Clients pay by transfer; you mark the booking paid when funds arrive.")}
        </div>
        <div className="sm:col-span-2"><label className="label text-xs">Bank transfer instructions</label><textarea className="input" rows={5} value={s.bankInstructions} onChange={(e) => set("bankInstructions", e.target.value)} /></div>
        <div><label className="label text-xs">Default currency</label><input className="input" maxLength={3} value={s.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label text-xs">Tax label</label><input className="input" value={s.taxLabel} onChange={(e) => set("taxLabel", e.target.value)} /></div>
          <div><label className="label text-xs">Tax rate %</label><input className="input" type="number" min={0} max={50} step="0.01" value={s.taxRatePercent} onChange={(e) => set("taxRatePercent", Number(e.target.value))} /></div>
        </div>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-extrabold sm:col-span-2">Notifications</h2>
        <div><label className="label text-xs">Sender name</label><input className="input" value={s.senderName} onChange={(e) => set("senderName", e.target.value)} /><p className="hint">The sending address is set by EMAIL_FROM on the server.</p></div>
        <div><label className="label text-xs">Admin notification email</label><input className="input" type="email" value={s.adminNotifyEmail} onChange={(e) => set("adminNotifyEmail", e.target.value)} /></div>
        <div><label className="label text-xs">Reminders (hours before meeting, comma-separated)</label><input className="input" value={s.reminderHours.join(", ")} onChange={(e) => set("reminderHours", e.target.value.split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => n > 0))} /></div>
        <div><label className="label text-xs">Email footer</label><input className="input" value={s.emailFooter} onChange={(e) => set("emailFooter", e.target.value)} /></div>
        <details className="rounded-xl border border-line p-3 sm:col-span-2">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Customise email templates</summary>
          <p className="mt-2 text-xs text-muted">Leave blank to use the default wording. Placeholders: {"{ref} {service} {name} {date}"}</p>
          <div className="mt-3 space-y-4">
            {TEMPLATES.map(([key, label]) => (
              <div key={key} className="grid gap-2 sm:grid-cols-[200px_1fr]">
                <b className="pt-2 text-sm text-ink">{label}</b>
                <div className="space-y-2">
                  <input className="input" placeholder="Subject (default)" value={s.emailTemplates[key]?.subject ?? ""} onChange={(e) => tpl(key, "subject", e.target.value)} aria-label={`${label} subject`} />
                  <textarea className="input" rows={2} placeholder="Opening message (default)" value={s.emailTemplates[key]?.intro ?? ""} onChange={(e) => tpl(key, "intro", e.target.value)} aria-label={`${label} message`} />
                </div>
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="card grid gap-4 p-5">
        <h2 className="font-extrabold">Policies</h2>
        <div><label className="label text-xs">Cancellation &amp; rescheduling policy</label><textarea className="input" rows={4} value={s.cancellationPolicy} onChange={(e) => set("cancellationPolicy", e.target.value)} /></div>
        <div><label className="label text-xs">Refund policy</label><textarea className="input" rows={4} value={s.refundPolicy} onChange={(e) => set("refundPolicy", e.target.value)} /></div>
      </section>

      <div className="sticky bottom-4 flex items-center gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-card">
        <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save settings"}</button>
        {msg && <span className="text-sm text-green-700">{msg}</span>}{err && <span className="err">{err}</span>}
      </div>
    </div>
  );
}

export function TeamForm() {
  const [f, setF] = useState({ name: "", email: "", role: "STAFF", password: "" });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  return (
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      try { await api("/api/admin/users", "POST", f); window.location.reload(); } catch (x) { setErr((x as Error).message); setBusy(false); }
    }}>
      <input className="input" placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Name" />
      <input className="input" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="Email" />
      <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} aria-label="Role"><option value="STAFF">Staff — meetings & clients</option><option value="ADMIN">Admin — full access</option></select>
      <input className="input" type="password" placeholder="Temporary password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-label="Temporary password" />
      <button className="btn-primary" disabled={busy}>Add team member</button>
      {err && <p className="err sm:col-span-2 lg:col-span-5">{err}</p>}
    </form>
  );
}

export function CouponForm() {
  const [f, setF] = useState({ code: "", type: "percent", value: "", maxRedemptions: "", validTo: "" });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  return (
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      try {
        await api("/api/admin/coupons", "POST", { code: f.code, percentOff: f.type === "percent" ? Number(f.value) : null, amountOff: f.type === "amount" ? Number(f.value) : null, maxRedemptions: f.maxRedemptions ? Number(f.maxRedemptions) : null, validTo: f.validTo || null });
        window.location.reload();
      } catch (x) { setErr((x as Error).message); setBusy(false); }
    }}>
      <input className="input" placeholder="CODE" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} aria-label="Coupon code" />
      <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} aria-label="Discount type"><option value="percent">% off</option><option value="amount">Fixed amount off</option></select>
      <input className="input" type="number" min="0" step="0.01" placeholder={f.type === "percent" ? "10" : "5.00"} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} aria-label="Discount value" />
      <input className="input" type="number" min="1" placeholder="Max uses (optional)" value={f.maxRedemptions} onChange={(e) => setF({ ...f, maxRedemptions: e.target.value })} aria-label="Maximum uses" />
      <input className="input" type="date" value={f.validTo} onChange={(e) => setF({ ...f, validTo: e.target.value })} aria-label="Valid until" />
      <button className="btn-primary" disabled={busy}>Create coupon</button>
      {err && <p className="err sm:col-span-2 lg:col-span-6">{err}</p>}
    </form>
  );
}
