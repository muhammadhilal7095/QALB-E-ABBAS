"use client";

import Link from "next/link";
import { useState } from "react";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, ...j } as { ok: boolean; error?: string; role?: string; unverified?: boolean };
}

export function LoginForm({ admin = false, next }: { admin?: boolean; next?: string }) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [unverified, setUnverified] = useState(false), [resent, setResent] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await post("/api/auth/login", { email, password, admin });
    if (!r.ok) { setErr(r.error || "Sign-in failed."); setUnverified(!!r.unverified); setBusy(false); return; }
    const staff = r.role === "ADMIN" || r.role === "STAFF";
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    window.location.href = safeNext || (staff ? "/admin" : "/account");
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div><label htmlFor="email" className="label">Email</label><input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div><label htmlFor="password" className="label">Password</label><input id="password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      {err && <p className="err" role="alert">{err}</p>}
      {unverified && !resent && <button type="button" className="text-sm font-semibold text-brand underline" onClick={async () => { await post("/api/auth/resend", { email }); setResent(true); }}>Resend verification email</button>}
      {resent && <p className="text-sm text-green-700">Verification email sent.</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      {!admin && <div className="flex justify-between text-sm"><Link href="/account/forgot" className="text-brand">Forgot password?</Link><Link href="/account/register" className="text-brand">Create an account</Link></div>}
    </form>
  );
}

export function RegisterForm() {
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await post("/api/auth/register", f);
    setBusy(false);
    if (!r.ok) { setErr(r.error || "Could not create account."); return; }
    setDone(true);
  }
  if (done) return <div className="rounded-xl bg-green-50 p-4 text-sm text-green-900">Almost there — we&apos;ve sent a verification link to <b>{f.email}</b>. Click it to activate your account, then sign in.</div>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div><label htmlFor="name" className="label">Full name</label><input id="name" autoComplete="name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><label htmlFor="email" className="label">Email</label><input id="email" type="email" autoComplete="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      <div><label htmlFor="password" className="label">Password</label><input id="password" type="password" autoComplete="new-password" className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><p className="hint">At least 10 characters, with letters and numbers.</p></div>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      <p className="text-center text-sm">Already have an account? <Link href="/account/login" className="font-semibold text-brand">Sign in</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState(""), [done, setDone] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  return done ? <p className="rounded-xl bg-green-50 p-4 text-sm text-green-900">If an account exists for that email, a reset link is on its way. It expires in 1 hour.</p> : (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await post("/api/auth/forgot", { email }); setBusy(false); if (r.ok) setDone(true); else setErr(r.error || "Please try again."); }}>
      <div><label htmlFor="email" className="label">Email</label><input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      {err && <p className="err">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>Send reset link</button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [pw, setPw] = useState(""), [err, setErr] = useState(""), [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  return done ? <p className="rounded-xl bg-green-50 p-4 text-sm text-green-900">Your password has been updated. <Link href="/account/login" className="font-semibold underline">Sign in</Link></p> : (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(""); const r = await post("/api/auth/reset", { token, password: pw }); setBusy(false); if (r.ok) setDone(true); else setErr(r.error || "Please try again."); }}>
      <div><label htmlFor="pw" className="label">New password</label><input id="pw" type="password" autoComplete="new-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} /><p className="hint">At least 10 characters, with letters and numbers.</p></div>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>Update password</button>
    </form>
  );
}

export function LogoutButton({ to = "/" }: { to?: string }) {
  return <button type="button" className="btn-ghost btn-sm" onClick={async () => { await post("/api/auth/logout", {}); window.location.href = to; }}>Sign out</button>;
}

export function ProfileForm({ initial }: { initial: { name: string; phone: string; company: string; website: string; country: string } }) {
  const [f, setF] = useState(initial), [msg, setMsg] = useState(""), [err, setErr] = useState("");
  const field = (k: keyof typeof f, label: string, type = "text") => (
    <div><label htmlFor={k} className="label">{label}</label><input id={k} type={type} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setMsg(""); setErr("");
      const r = await fetch("/api/account/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json(); if (r.ok) setMsg("Profile saved."); else setErr(j.error);
    }}>
      {field("name", "Full name")}
      {field("phone", "Phone (with country code, e.g. +447862605011)", "tel")}
      <div className="grid gap-4 sm:grid-cols-2">{field("company", "Company")}{field("website", "Website", "url")}</div>
      {field("country", "Country")}
      {err && <p className="err">{err}</p>}{msg && <p className="text-sm text-green-700">{msg}</p>}
      <button className="btn-primary">Save profile</button>
    </form>
  );
}
