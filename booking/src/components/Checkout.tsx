"use client";

import { useEffect, useState } from "react";

const LABELS: Record<string, [string, string]> = {
  STRIPE: ["Pay by card", "Visa, Mastercard, Amex, Apple Pay & Google Pay — secured by Stripe."],
  BANK_TRANSFER: ["Bank transfer", "Pay manually by bank transfer. Your slot is held while we wait for your payment."],
  MOCK: ["Test payment (development only)", "Simulates a payment gateway so the full journey can be tested without real money."],
};

export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  // Starts after mount so server and client render the same markup (no hydration mismatch).
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(new Date(expiresAt).getTime() - Date.now());
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, [expiresAt]);
  if (left === null) return <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Your slot is reserved — complete payment before the timer ends.</p>;
  if (left <= 0) return <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">Your reservation has expired. Please start a new booking.</p>;
  const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
  return <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="timer" aria-live="off">Your slot is reserved for <b>{m}:{String(s).padStart(2, "0")}</b> — complete payment before the timer ends.</p>;
}

export function PayOptions({ reference, token, gateways, dueLabel }: { reference: string; token: string; gateways: string[]; dueLabel: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  async function pay(gateway: string) {
    setBusy(gateway); setErr("");
    const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference, token, gateway }) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error || "Could not start payment."); setBusy(null); return; }
    window.location.href = j.redirectUrl;
  }
  if (!gateways.length) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Online payment is not available right now. Please contact us on +44 7862 605011 to complete your booking.</p>;
  return (
    <div className="space-y-3">
      {gateways.map((g) => (
        <button key={g} type="button" onClick={() => pay(g)} disabled={!!busy}
          className={`flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left transition hover:border-brand ${g === "STRIPE" ? "border-brand/50" : "border-line"} disabled:opacity-60`}>
          <span><b className="block text-ink">{LABELS[g]?.[0] ?? g}</b><span className="text-sm">{LABELS[g]?.[1]}</span></span>
          <span className={g === "STRIPE" ? "btn-gold shrink-0" : "btn-ghost shrink-0"}>{busy === g ? "Please wait…" : g === "BANK_TRANSFER" ? "Choose" : `Pay ${dueLabel}`}</span>
        </button>
      ))}
      {err && <p className="err" role="alert">{err}</p>}
      <p className="pt-1 text-xs text-muted">🔒 We never see or store your card details. Payments are verified securely on our server before your booking is confirmed.</p>
    </div>
  );
}

export function MockGateway({ paymentId, amount }: { paymentId: string; amount: string }) {
  const [busy, setBusy] = useState(false);
  async function go(outcome: string) {
    setBusy(true);
    const r = await fetch("/api/payments/mock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId, outcome }) });
    const j = await r.json();
    if (r.ok) window.location.href = j.redirectUrl; else { alert(j.error); setBusy(false); }
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <button className="btn bg-green-600 text-white hover:bg-green-700" disabled={busy} onClick={() => go("succeed")}>Pay {amount}</button>
      <button className="btn-danger" disabled={busy} onClick={() => go("fail")}>Simulate decline</button>
      <button className="btn-ghost" disabled={busy} onClick={() => go("cancel")}>Cancel</button>
    </div>
  );
}

export function RefreshWhilePending({ seconds = 4 }: { seconds?: number }) {
  useEffect(() => { const t = setTimeout(() => window.location.reload(), seconds * 1000); return () => clearTimeout(t); }, [seconds]);
  return null;
}
