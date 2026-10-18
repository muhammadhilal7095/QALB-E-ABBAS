"use client";

import { useEffect, useMemo, useState } from "react";

type Service = { id: string; slug: string; name: string; description: string; durationMin: number; priceCents: number; currency: string; paymentRequirement: string; depositPercent: number };
type Slot = { start: string; end: string };
type Quote = { currency: string; priceCents: number; discountCents: number; taxCents: number; totalCents: number; dueNowCents: number; taxLabel: string; taxRatePercent: number; couponError: string | null; coupon: { code: string } | null; paymentRequirement: string; depositPercent: number };
type Upload = { id: string; filename: string; size: number };

const PLATFORMS = ["Google Meet", "Zoom", "Microsoft Teams", "Phone call", "WhatsApp call", "No preference"];
const COMM = ["Email", "Phone", "WhatsApp"];
const DIAL = [["+44", "UK"], ["+1", "US/Canada"], ["+92", "Pakistan"], ["+971", "UAE"], ["+356", "Malta"], ["+91", "India"], ["+966", "Saudi Arabia"], ["+974", "Qatar"], ["+965", "Kuwait"], ["+968", "Oman"], ["+973", "Bahrain"], ["+353", "Ireland"], ["+49", "Germany"], ["+33", "France"], ["+34", "Spain"], ["+39", "Italy"], ["+31", "Netherlands"], ["+61", "Australia"], ["+64", "New Zealand"], ["+27", "South Africa"], ["+234", "Nigeria"], ["+880", "Bangladesh"], ["+90", "Turkey"], ["+60", "Malaysia"], ["+65", "Singapore"], ["+20", "Egypt"]];
const COUNTRIES = ["United Kingdom", "United States", "Pakistan", "United Arab Emirates", "Malta", "India", "Saudi Arabia", "Qatar", "Canada", "Australia", "Ireland", "Germany", "France", "Spain", "Italy", "Netherlands", "Bangladesh", "Turkey", "Malaysia", "Singapore", "South Africa", "Nigeria", "Egypt", "Kuwait", "Oman", "Bahrain", "New Zealand"];
const STEPS = ["Meeting type", "Purpose", "Date & time", "Your details", "Review"];

const money = (c: number, cur: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency: cur }).format(c / 100);
const localDate = (iso: string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const localTime = (iso: string, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const longDate = (iso: string, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

interface Draft {
  serviceId: string; title: string; purpose: string; description: string; questions: string; expectedOutcome: string; notes: string;
  timezone: string; slot: Slot | null;
  clientName: string; clientEmail: string; dial: string; phone: string; company: string; website: string; country: string;
  commMethod: string; platformPref: string; additionalInfo: string; couponCode: string; draftToken: string; uploads: Upload[];
}

function newToken() {
  const a = new Uint8Array(18); crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function BookingWizard(props: { services: Service[]; initialServiceId: string; prefill: Partial<Draft>; taxLabel: string; termsUrl: string; policyUrl: string }) {
  const storageKey = "qa-booking-draft";
  const [step, setStep] = useState(1);
  const [d, setD] = useState<Draft>(() => ({
    serviceId: props.initialServiceId, title: "", purpose: "", description: "", questions: "", expectedOutcome: "", notes: "",
    timezone: "UTC", slot: null, clientName: "", clientEmail: "", dial: "+44", phone: "", company: "", website: "", country: "",
    commMethod: "Email", platformPref: "No preference", additionalInfo: "", couponCode: "", draftToken: "", uploads: [], ...props.prefill,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  // Restore saved progress (so going back/forward or refreshing keeps answers).
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let saved: Partial<Draft> = {};
    try { saved = JSON.parse(sessionStorage.getItem(storageKey) || "{}"); } catch { /* ignore */ }
    setD((prev) => ({ ...prev, ...saved, serviceId: props.initialServiceId || saved.serviceId || prev.serviceId, timezone: saved.timezone || tz, draftToken: saved.draftToken || newToken(), ...(saved.serviceId && saved.serviceId !== props.initialServiceId ? { slot: null } : {}) }));
    setStep(1 + (props.initialServiceId ? 1 : 0));
    setLoaded(true);
  }, [props.initialServiceId]);
  useEffect(() => { if (loaded) try { sessionStorage.setItem(storageKey, JSON.stringify(d)); } catch { /* ignore */ } }, [d, loaded]);

  const service = props.services.find((s) => s.id === d.serviceId) ?? props.services[0];
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 2) {
      if (d.title.trim().length < 3) e.title = "Please add a short meeting title.";
      if (d.purpose.trim().length < 10) e.purpose = "Please explain the purpose (at least 10 characters).";
      if (d.description.trim().length < 20) e.description = "Please describe your requirements (at least 20 characters).";
    }
    if (s === 3 && !d.slot) e.slot = "Please choose a date and time.";
    if (s === 4) {
      if (d.clientName.trim().length < 2) e.clientName = "Please enter your full name.";
      if (!/^\S+@\S+\.\S+$/.test(d.clientEmail.trim())) e.clientEmail = "Please enter a valid email address.";
      if (!/^\d{6,14}$/.test(d.phone.replace(/[\s-]/g, "").replace(/^0+/, ""))) e.phone = "Please enter a valid phone number.";
      if (!d.country.trim()) e.country = "Please select your country.";
      if (d.website && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(d.website.trim())) e.website = "Website must start with http:// or https://";
    }
    setErrors(e);
    if (Object.keys(e).length) {
      const first = document.querySelector(`[name="${Object.keys(e)[0]}"]`) as HTMLElement | null;
      first?.focus();
    }
    return !Object.keys(e).length;
  }
  const next = () => { if (validate(step)) { setStep((s) => Math.min(5, s + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  const back = () => { setStep((s) => Math.max(1, s - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (!loaded) return <div className="card p-8 text-center text-muted">Loading…</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <ol className="mb-6 grid grid-cols-5 gap-1.5" aria-label="Booking progress">
          {STEPS.map((label, i) => {
            const n = i + 1, done = n < step, current = n === step;
            return (
              <li key={label}>
                <button type="button" disabled={n > step} onClick={() => n < step && setStep(n)} aria-current={current ? "step" : undefined}
                  className={`flex w-full flex-col items-start gap-1.5 text-left ${n < step ? "cursor-pointer" : "cursor-default"}`}>
                  <span className={`h-1.5 w-full rounded-full ${done || current ? "bg-brand" : "bg-line"}`} />
                  <span className={`text-[11px] font-semibold sm:text-xs ${current ? "text-brand" : done ? "text-ink" : "text-muted"}`}>{n}. {label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="card p-5 sm:p-7">
          {step === 1 && (
            <section>
              <h2 className="text-xl font-extrabold">Select a meeting type</h2>
              <div className="mt-5 grid gap-3">
                {props.services.map((s) => (
                  <label key={s.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${d.serviceId === s.id ? "border-brand bg-brand-tint" : "border-line hover:border-brand/40"}`}>
                    <input type="radio" name="serviceId" className="mt-1 h-4 w-4 accent-brand" checked={d.serviceId === s.id} onChange={() => setD((p) => ({ ...p, serviceId: s.id, slot: null }))} />
                    <span className="flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-ink">{s.name}</b><span className="text-sm font-bold text-ink">{s.durationMin} min · {s.priceCents ? money(s.priceCents, s.currency) : "Free"}</span></span>
                      <span className="mt-1 block text-sm">{s.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {step === 2 && <PurposeStep d={d} set={set} errors={errors} serviceName={service.name} />}
          {step === 3 && <DateStep d={d} set={set} service={service} error={errors.slot} />}
          {step === 4 && <DetailsStep d={d} set={set} errors={errors} />}
          {step === 5 && <ReviewStep d={d} set={set} service={service} termsUrl={props.termsUrl} policyUrl={props.policyUrl} onBack={(s) => setStep(s)} onDone={() => sessionStorage.removeItem(storageKey)} />}

          {step < 5 && (
            <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-line pt-5">
              <button type="button" onClick={back} disabled={step === 1} className="btn-ghost">Back</button>
              <button type="button" onClick={next} className="btn-primary">Continue</button>
            </div>
          )}
        </div>
      </div>

      <aside className="card h-fit p-5 lg:sticky lg:top-24">
        <p className="eyebrow">Your booking</p>
        <h3 className="mt-2 font-extrabold leading-snug">{service.name}</h3>
        <dl className="mt-4 space-y-2.5 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted">Duration</dt><dd className="font-semibold text-ink">{service.durationMin} minutes</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Fee</dt><dd className="font-semibold text-ink">{service.priceCents ? money(service.priceCents, service.currency) : "Free"}</dd></div>
          {d.slot && <div className="flex justify-between gap-3"><dt className="text-muted">When</dt><dd className="text-right font-semibold text-ink">{longDate(d.slot.start, d.timezone)}<br />{localTime(d.slot.start, d.timezone)}–{localTime(d.slot.end, d.timezone)}</dd></div>}
          {d.slot && <div className="flex justify-between gap-3"><dt className="text-muted">Time zone</dt><dd className="text-right font-semibold text-ink">{d.timezone.replace(/_/g, " ")}</dd></div>}
        </dl>
        <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-muted">Your answers are saved as you go — you can step back and edit anything before paying.</p>
      </aside>
    </div>
  );
}

function Field({ label, name, error, hint, required, children }: { label: string; name: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}{required && <span className="text-red-600"> *</span>}</label>
      {children}
      {error ? <p className="err" id={`${name}-err`}>{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

function PurposeStep({ d, set, errors, serviceName }: { d: Draft; set: <K extends keyof Draft>(k: K, v: Draft[K]) => void; errors: Record<string, string>; serviceName: string }) {
  const [uploading, setUploading] = useState(false);
  const [uErr, setUErr] = useState("");
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUErr(""); setUploading(true);
    const added: Upload[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData(); fd.append("file", file); fd.append("draftToken", d.draftToken);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { setUErr(j.error || "Upload failed."); break; }
      added.push(j);
    }
    if (added.length) set("uploads", [...d.uploads, ...added]);
    setUploading(false);
  }
  const ta = (name: keyof Draft, rows = 3) => ({ id: name, name, rows, className: "input", value: d[name] as string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => set(name, e.target.value as never), "aria-invalid": !!errors[name] });
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold">What would you like to discuss?</h2>
        <p className="mt-1 text-sm">This helps our team prepare for your {serviceName.toLowerCase()}.</p>
      </div>
      <Field label="Meeting title" name="title" error={errors.title} required hint="e.g. New Shopify store for my clothing brand">
        <input id="title" name="title" className="input" value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={150} aria-invalid={!!errors.title} />
      </Field>
      <Field label="Purpose of the meeting" name="purpose" error={errors.purpose} required><textarea {...ta("purpose", 3)} maxLength={1000} /></Field>
      <Field label="Detailed description of your requirements" name="description" error={errors.description} required><textarea {...ta("description", 5)} maxLength={5000} /></Field>
      <Field label="Questions or issues to discuss" name="questions"><textarea {...ta("questions", 3)} maxLength={3000} /></Field>
      <Field label="Expected outcome" name="expectedOutcome" hint="What would make this meeting a success for you?"><textarea {...ta("expectedOutcome", 2)} maxLength={2000} /></Field>
      <Field label="Additional notes" name="notes"><textarea {...ta("notes", 2)} maxLength={2000} /></Field>
      <div>
        <span className="label">Attachments (optional)</span>
        <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-line p-5 text-sm text-muted hover:border-brand/50">
          <input type="file" className="sr-only" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt" onChange={(e) => upload(e.target.files)} disabled={uploading || d.uploads.length >= 3} />
          {uploading ? "Uploading…" : d.uploads.length >= 3 ? "Maximum of 3 files reached" : "Click to attach files — PDF, JPG, PNG, DOC, DOCX, TXT · up to 5 MB each"}
        </label>
        {uErr && <p className="err">{uErr}</p>}
        {d.uploads.length > 0 && <ul className="mt-2 space-y-1 text-sm">{d.uploads.map((u) => <li key={u.id} className="flex items-center gap-2"><span aria-hidden>📎</span>{u.filename} <span className="text-muted">({Math.round(u.size / 1024)} KB)</span></li>)}</ul>}
      </div>
    </section>
  );
}

function DateStep({ d, set, service, error }: { d: Draft; set: <K extends keyof Draft>(k: K, v: Draft[K]) => void; service: Service; error?: string }) {
  const tz = d.timezone;
  const todayLocal = localDate(new Date().toISOString(), tz);
  const [month, setMonth] = useState(() => (d.slot ? localDate(d.slot.start, tz) : todayLocal).slice(0, 7));
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(d.slot ? localDate(d.slot.start, tz) : null);
  const zones = useMemo(() => { try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone"); } catch { return [tz]; } }, [tz]);

  useEffect(() => {
    let cancelled = false;
    setSlots(null); setLoadErr("");
    const [y, m] = month.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1) - 86400_000);
    const to = new Date(Date.UTC(y, m, 1) + 86400_000);
    const now = new Date();
    fetch(`/api/slots?serviceId=${service.id}&from=${(from < now ? now : from).toISOString()}&to=${to.toISOString()}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j.slots as Slot[]; })
      .then((s) => { if (!cancelled) setSlots(s); })
      .catch((e) => { if (!cancelled) setLoadErr(e.message || "Could not load availability."); });
    return () => { cancelled = true; };
  }, [month, service.id]);

  const byDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots ?? []) { const k = localDate(s.start, tz); if (!map.has(k)) map.set(k, []); map.get(k)!.push(s); }
    return map;
  }, [slots, tz]);

  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first grid
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const shift = (n: number) => { const dt = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(dt.toISOString().slice(0, 7)); setSelectedDate(null); };
  const canGoBack = month > todayLocal.slice(0, 7);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">Choose a date and time</h2>
          <p className="mt-1 text-sm">{service.durationMin}-minute meeting · times shown in your time zone</p>
        </div>
        <div className="w-full sm:w-64">
          <label htmlFor="tz" className="label">Time zone</label>
          <select id="tz" className="input" value={tz} onChange={(e) => { set("timezone", e.target.value); setSelectedDate(null); }}>
            {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_240px]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <button type="button" className="btn-ghost btn-sm" onClick={() => shift(-1)} disabled={!canGoBack} aria-label="Previous month">‹</button>
            <span className="font-display font-extrabold text-ink" aria-live="polite">{monthLabel}</span>
            <button type="button" className="btn-ghost btn-sm" onClick={() => shift(1)} aria-label="Next month">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => <div key={w} className="py-1">{w}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, "0")}`;
              const count = byDate.get(date)?.length ?? 0;
              const available = count > 0;
              const sel = selectedDate === date;
              return (
                <button key={date} type="button" disabled={!available} onClick={() => setSelectedDate(date)} aria-pressed={sel}
                  aria-label={`${date}${available ? `, ${count} times available` : ", unavailable"}`}
                  className={`aspect-square rounded-lg text-sm font-semibold transition ${sel ? "bg-brand text-white" : available ? "bg-brand-tint text-brand hover:bg-brand hover:text-white" : "cursor-not-allowed text-[#B7C1D1] line-through decoration-[#D5DCE7]"}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          {slots === null && !loadErr && <p className="mt-3 text-sm text-muted" role="status">Loading availability…</p>}
          {loadErr && <p className="err mt-3">{loadErr}</p>}
          {slots && slots.length === 0 && <p className="mt-3 text-sm text-muted">No times available this month — try the next month.</p>}
        </div>
        <div>
          <p className="label">{selectedDate ? longDate(byDate.get(selectedDate)![0].start, tz) : "Select a date"}</p>
          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1 md:grid-cols-1">
            {(selectedDate ? byDate.get(selectedDate) ?? [] : []).map((s) => {
              const sel = d.slot?.start === s.start;
              return (
                <button key={s.start} type="button" onClick={() => set("slot", s)} aria-pressed={sel}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${sel ? "border-brand bg-brand text-white" : "border-line text-ink hover:border-brand hover:text-brand"}`}>
                  {localTime(s.start, tz)} – {localTime(s.end, tz)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {error && <p className="err mt-4" role="alert">{error}</p>}
    </section>
  );
}

function DetailsStep({ d, set, errors }: { d: Draft; set: <K extends keyof Draft>(k: K, v: Draft[K]) => void; errors: Record<string, string> }) {
  const inp = (name: keyof Draft, type = "text", auto?: string) => ({ id: name, name, type, autoComplete: auto, className: "input", value: d[name] as string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(name, e.target.value as never), "aria-invalid": !!errors[name] });
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-extrabold">Your details</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" name="clientName" error={errors.clientName} required><input {...inp("clientName", "text", "name")} /></Field>
        <Field label="Email address" name="clientEmail" error={errors.clientEmail} required><input {...inp("clientEmail", "email", "email")} /></Field>
      </div>
      <Field label="Phone number" name="phone" error={errors.phone} required hint="We'll only use this about your meeting.">
        <div className="flex gap-2">
          <select aria-label="Country code" className="input w-36 shrink-0" value={d.dial} onChange={(e) => set("dial", e.target.value)}>
            {DIAL.map(([c, n]) => <option key={c + n} value={c}>{c} {n}</option>)}
          </select>
          <input {...inp("phone", "tel", "tel-national")} inputMode="tel" placeholder="7862 605011" />
        </div>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Company name" name="company"><input {...inp("company", "text", "organization")} /></Field>
        <Field label="Website URL" name="website" error={errors.website}><input {...inp("website", "url", "url")} placeholder="https://" /></Field>
      </div>
      <Field label="Country" name="country" error={errors.country} required>
        <input {...inp("country", "text", "country-name")} list="countries" />
        <datalist id="countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Preferred communication" name="commMethod">
          <select id="commMethod" name="commMethod" className="input" value={d.commMethod} onChange={(e) => set("commMethod", e.target.value)}>{COMM.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Meeting platform preference" name="platformPref">
          <select id="platformPref" name="platformPref" className="input" value={d.platformPref} onChange={(e) => set("platformPref", e.target.value)}>{PLATFORMS.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
      </div>
      <Field label="Additional information" name="additionalInfo">
        <textarea id="additionalInfo" name="additionalInfo" rows={3} className="input" value={d.additionalInfo} onChange={(e) => set("additionalInfo", e.target.value)} maxLength={2000} />
      </Field>
    </section>
  );
}

function ReviewStep({ d, set, service, termsUrl, policyUrl, onBack, onDone }: { d: Draft; set: <K extends keyof Draft>(k: K, v: Draft[K]) => void; service: Service; termsUrl: string; policyUrl: string; onBack: (s: number) => void; onDone: () => void }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [coupon, setCoupon] = useState(d.couponCode);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function loadQuote(code: string) {
    const r = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId: service.id, couponCode: code || null }) });
    const j = await r.json();
    if (r.ok) setQuote(j.quote); else setErr(j.error);
  }
  useEffect(() => { loadQuote(d.couponCode); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!agree) { setErr("Please accept the terms and cancellation policy."); return; }
    setBusy(true); setErr("");
    const phone = `${d.dial}${d.phone.replace(/[\s-]/g, "").replace(/^0+/, "")}`;
    const res = await fetch("/api/bookings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: service.id, startAt: d.slot!.start, clientTimezone: d.timezone, couponCode: quote?.coupon ? d.couponCode : null,
        title: d.title, purpose: d.purpose, description: d.description, questions: d.questions, expectedOutcome: d.expectedOutcome, notes: d.notes,
        clientName: d.clientName, clientEmail: d.clientEmail, clientPhone: phone, company: d.company, website: d.website, country: d.country,
        commMethod: d.commMethod, platformPref: d.platformPref, additionalInfo: d.additionalInfo, draftToken: d.draftToken,
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      setBusy(false);
      setErr(j.error || "Could not create your booking.");
      if (res.status === 409 && j.code === "SLOT_TAKEN") set("slot", null);
      return;
    }
    onDone();
    window.location.href = j.status === "HELD" ? `/book/checkout?booking=${j.reference}&token=${j.token}` : `/booking/${j.reference}?token=${j.token}`;
  }

  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-4 py-2"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold text-ink">{v}</dd></div>;
  return (
    <section>
      <h2 className="text-xl font-extrabold">Review your booking</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between"><h3 className="font-extrabold">Meeting</h3><button type="button" className="text-sm font-semibold text-brand" onClick={() => onBack(2)}>Edit</button></div>
          <dl className="mt-2 divide-y divide-line text-sm">
            {row("Type", service.name)}
            {row("Title", d.title)}
            {row("Purpose", <span className="line-clamp-3">{d.purpose}</span>)}
          </dl>
        </div>
        <div className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between"><h3 className="font-extrabold">Date &amp; time</h3><button type="button" className="text-sm font-semibold text-brand" onClick={() => onBack(3)}>Edit</button></div>
          <dl className="mt-2 divide-y divide-line text-sm">
            {d.slot ? <>{row("Date", longDate(d.slot.start, d.timezone))}{row("Time", `${localTime(d.slot.start, d.timezone)} – ${localTime(d.slot.end, d.timezone)}`)}{row("Duration", `${service.durationMin} minutes`)}{row("Time zone", d.timezone.replace(/_/g, " "))}</> : <p className="err py-2">Please choose a new time.</p>}
          </dl>
        </div>
        <div className="rounded-xl border border-line p-4 md:col-span-2">
          <div className="flex items-center justify-between"><h3 className="font-extrabold">Your details</h3><button type="button" className="text-sm font-semibold text-brand" onClick={() => onBack(4)}>Edit</button></div>
          <p className="mt-2 text-sm text-ink">{d.clientName} · {d.clientEmail} · {d.dial} {d.phone}{d.company ? ` · ${d.company}` : ""} · {d.country}</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-line bg-soft p-4">
        <h3 className="font-extrabold">Price summary</h3>
        {!quote ? <p className="mt-2 text-sm text-muted" role="status">Calculating…</p> : (
          <dl className="mt-2 divide-y divide-line text-sm">
            {row("Meeting fee", money(quote.priceCents, quote.currency))}
            {quote.discountCents > 0 && row(`Discount (${quote.coupon?.code})`, `−${money(quote.discountCents, quote.currency)}`)}
            {quote.taxCents > 0 && row(`${quote.taxLabel} (${quote.taxRatePercent}%)`, money(quote.taxCents, quote.currency))}
            {row("Total", <span className="text-base">{money(quote.totalCents, quote.currency)}</span>)}
            {quote.paymentRequirement === "DEPOSIT" && row(`Due now (${quote.depositPercent}% deposit)`, money(quote.dueNowCents, quote.currency))}
            {row("Payment status", "Not yet paid")}
          </dl>
        )}
        <div className="mt-3 flex gap-2">
          <input aria-label="Coupon code" className="input" placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
          <button type="button" className="btn-ghost" onClick={async () => { set("couponCode", coupon); setErr(""); await loadQuote(coupon); }}>Apply</button>
        </div>
        {quote?.couponError && <p className="err">{quote.couponError}</p>}
        {quote?.coupon && <p className="mt-1 text-xs font-semibold text-green-700">Coupon {quote.coupon.code} applied.</p>}
      </div>

      <label className="mt-5 flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>I agree to the <a href={termsUrl} target="_blank" className="font-semibold text-brand underline">Terms and Conditions</a> and the <a href={policyUrl} target="_blank" className="font-semibold text-brand underline">Cancellation &amp; Refund Policy</a>.</span>
      </label>
      {err && <p className="err mt-3" role="alert">{err}</p>}
      <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-line pt-5">
        <button type="button" className="btn-ghost" onClick={() => onBack(4)}>Back</button>
        <button type="button" className="btn-gold" onClick={submit} disabled={busy || !d.slot || !quote}>{busy ? "Reserving your slot…" : quote && quote.dueNowCents === 0 ? "Confirm booking" : "Reserve & continue to payment"}</button>
      </div>
      <p className="mt-3 text-xs text-muted">Your slot is reserved for a short time while you complete payment.</p>
    </section>
  );
}
