"use client";
import { useState } from "react";

/** DEVELOPMENT ONLY — buttons that simulate the payment result. */
export function TestGateway({ p, amount }: { p: string; amount: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go(outcome: "succeed" | "cancel") {
    setBusy(true); setError("");
    const r = await fetch("/api/test-pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p, outcome }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.redirectUrl) window.location.href = j.redirectUrl;
    else { setError(j.error || "Something went wrong."); setBusy(false); }
  }
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button className="btn bg-green-600 text-white hover:bg-green-700" disabled={busy} onClick={() => go("succeed")}>Pay {amount}</button>
        <button className="btn-ghost" disabled={busy} onClick={() => go("cancel")}>Cancel</button>
      </div>
      {error && <p className="err mt-3" role="alert">{error}</p>}
    </div>
  );
}
