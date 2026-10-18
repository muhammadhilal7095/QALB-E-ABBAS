"use client";
import { useState } from "react";

const LABELS: Record<string, string> = { STRIPE: "Pay by card", BANK_TRANSFER: "Pay by bank transfer", MOCK: "Test payment (dev)" };

/** Lets the client (re)start payment for an unpaid order. */
export function PayOrder({ reference, token, gateways }: { reference: string; token: string; gateways: string[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function pay(gateway: string) {
    setBusy(gateway); setError(null);
    const r = await fetch(`/api/orders/${encodeURIComponent(reference)}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, gateway }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.redirectUrl) window.location.href = j.redirectUrl;
    else { setError(j.error || "Payment could not be started. Please try again."); setBusy(null); }
  }
  if (!gateways.length) return <p className="text-sm">Online payment is not available right now. Please contact us to complete your order.</p>;
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {gateways.map((g, i) => (
          <button key={g} className={i === 0 ? "btn-gold" : "btn-ghost"} disabled={!!busy} onClick={() => pay(g)}>
            {busy === g ? "Please wait…" : LABELS[g] || g}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}

export function MockOrderGateway({ paymentId, amount }: { paymentId: string; amount: string }) {
  const [busy, setBusy] = useState(false);
  async function go(outcome: string) {
    setBusy(true);
    const r = await fetch("/api/payments/mock-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId, outcome }) });
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
