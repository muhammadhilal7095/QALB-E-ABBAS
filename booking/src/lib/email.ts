import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { env } from "./env";
import { escapeHtml } from "./util";

export function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F6F8FC;font-family:Arial,Helvetica,sans-serif;color:#3B4A63">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FC;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #E3E8F0;border-radius:14px;overflow:hidden">
<tr><td style="padding:22px 28px;border-bottom:4px solid #F5B12E"><span style="font:800 20px Arial,sans-serif;color:#0B1B36">${escapeHtml(env.businessName())}</span></td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 16px;font:800 22px Arial,sans-serif;color:#0B1B36">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:18px 28px;background:#0B1B36;color:#C9D3E6;font-size:12px;line-height:1.6">${escapeHtml(env.businessName())} · Oldham, Manchester, United Kingdom · ${escapeHtml(env.adminEmail())}</td></tr>
</table></td></tr></table></body></html>`;
}

/** rows: [label, already-escaped HTML value] */
export function detailsTable(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #E3E8F0;border-radius:10px;font-size:14px">
${rows.map(([k, v], i) => `<tr><td style="padding:10px 14px;${i ? "border-top:1px solid #E3E8F0;" : ""}color:#5F6E85;width:38%;vertical-align:top">${escapeHtml(k)}</td><td style="padding:10px 14px;${i ? "border-top:1px solid #E3E8F0;" : ""}color:#0E1E3A;font-weight:bold">${v}</td></tr>`).join("")}
</table>`;
}

export function button(label: string, href: string): string {
  return `<p style="margin:22px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#F5B12E;color:#0B1B36;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${escapeHtml(label)}</a></p>`;
}

/**
 * Sends through Resend. `key` makes the send idempotent: the payment webhook and the
 * thank-you page may both try to send the same email — Resend delivers it only once.
 * Without RESEND_API_KEY (local development) the email is saved to ./.emails/ instead.
 */
export async function sendEmail(opts: { to: string; subject: string; html: string; key: string; replyTo?: string }) {
  if (env.emailConfigured()) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": opts.key.slice(0, 256) },
      body: JSON.stringify({
        from: `${env.businessName()} <${env.emailFrom()}>`, to: [opts.to], subject: opts.subject, html: opts.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return;
  }
  const dir = join(process.cwd(), ".emails");
  const file = join(dir, `${opts.key.replace(/[^A-Za-z0-9._-]/g, "_")}.html`);
  try { await access(file); return; } catch { /* not sent yet */ }
  await mkdir(dir, { recursive: true });
  await writeFile(file, `<!-- To: ${opts.to} | Subject: ${opts.subject} -->\n${opts.html}`);
  if (process.env.NODE_ENV !== "test") console.log(`[email saved — no RESEND_API_KEY] to=${opts.to} subject="${opts.subject}" file=.emails/${file.split("/").pop()}`);
}
