"use client";

import { useState } from "react";

export default function RequestChange({ reference, token, pending }: { reference: string; token?: string; pending: string | null }) {
  const [kind, setKind] = useState<"RESCHEDULE" | "CANCEL" | null>(null);
  const [msg, setMsg] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">(pending ? "done" : "idle");
  const [err, setErr] = useState("");
  async function send() {
    setState("busy"); setErr("");
    const r = await fetch(`/api/bookings/${reference}/request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, kind, message: msg }) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error); setState("idle"); return; }
    setState("done");
  }
  if (state === "done") return <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Your {(pending || kind || "").toLowerCase() === "cancel" ? "cancellation" : "change"} request has been sent. Our team will get back to you shortly.</p>;
  return (
    <div>
      {!kind ? (
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => setKind("RESCHEDULE")}>Request to reschedule</button>
          <button className="btn-ghost text-red-700" onClick={() => setKind("CANCEL")}>Request cancellation</button>
        </div>
      ) : (
        <div className="space-y-3">
          <label htmlFor="msg" className="label">{kind === "RESCHEDULE" ? "Which dates and times would suit you better?" : "Reason for cancellation"}</label>
          <textarea id="msg" className="input" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} />
          {err && <p className="err">{err}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={state === "busy" || msg.trim().length < 5} onClick={send}>{state === "busy" ? "Sending…" : "Send request"}</button>
            <button className="btn-ghost" onClick={() => setKind(null)}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
