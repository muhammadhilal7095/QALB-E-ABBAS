import type { Booking, MeetingService, MeetingLink, Setting } from "@prisma/client";
import { prisma } from "./db";
import { env, getSettings } from "./settings";
import { escapeHtml, formatInTz, formatMoney, tzAbbrev } from "./util";

export type TemplateKey =
  | "booking_received" | "payment_success" | "booking_confirmed" | "payment_failed" | "reminder"
  | "rescheduled" | "cancelled" | "refund_processed" | "bank_instructions" | "pending_approval"
  | "admin_new_booking" | "admin_attention" | "change_request" | "verify_email" | "password_reset";

const DEFAULT_SUBJECTS: Record<TemplateKey, string> = {
  booking_received: "We've received your booking request — {ref}",
  payment_success: "Payment received — {ref}",
  booking_confirmed: "Your meeting is confirmed — {date}",
  payment_failed: "Payment unsuccessful — {ref}",
  reminder: "Reminder: your meeting is coming up — {date}",
  rescheduled: "Your meeting has been rescheduled — {date}",
  cancelled: "Your meeting has been cancelled — {ref}",
  refund_processed: "Refund processed — {ref}",
  bank_instructions: "Bank transfer details for your booking — {ref}",
  pending_approval: "Payment received — awaiting confirmation ({ref})",
  admin_new_booking: "New booking: {service} — {ref}",
  admin_attention: "Action needed on booking {ref}",
  change_request: "Client request on booking {ref}",
  verify_email: "Verify your email address",
  password_reset: "Reset your password",
};

type BookingFull = Booking & { service: MeetingService; meetingLink?: MeetingLink | null };

export function layout(settings: Setting, title: string, bodyHtml: string): string {
  const logo = settings.logoUrl
    ? `<img src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(settings.businessName)}" height="36" style="display:block">`
    : `<span style="font:800 20px Arial,sans-serif;color:#0B1B36">${escapeHtml(settings.businessName)}</span>`;
  return `<!doctype html><html><body style="margin:0;background:#F6F8FC;font-family:Arial,Helvetica,sans-serif;color:#3B4A63">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FC;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #E3E8F0;border-radius:14px;overflow:hidden">
<tr><td style="padding:22px 28px;border-bottom:4px solid #F5B12E">${logo}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font:800 22px Arial,sans-serif;color:#0B1B36">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:18px 28px;background:#0B1B36;color:#C9D3E6;font-size:12px;line-height:1.6">${escapeHtml(settings.emailFooter)}</td></tr>
</table></td></tr></table></body></html>`;
}

export function detailsTable(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #E3E8F0;border-radius:10px;font-size:14px">
${rows.map(([k, v], i) => `<tr><td style="padding:10px 14px;${i ? "border-top:1px solid #E3E8F0;" : ""}color:#5F6E85;width:38%">${escapeHtml(k)}</td><td style="padding:10px 14px;${i ? "border-top:1px solid #E3E8F0;" : ""}color:#0E1E3A;font-weight:bold">${v}</td></tr>`).join("")}
</table>`;
}

export function button(label: string, href: string): string {
  return `<p style="margin:22px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#F5B12E;color:#0B1B36;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${escapeHtml(label)}</a></p>`;
}

export function bookingRows(b: BookingFull, tz: string): [string, string][] {
  const zone = tzAbbrev(b.startAt, tz);
  return [
    ["Reference", escapeHtml(b.reference)],
    ["Meeting", escapeHtml(b.service.name)],
    ["Purpose", escapeHtml(b.purpose)],
    ["Date & time", `${escapeHtml(formatInTz(b.startAt, tz))} (${escapeHtml(zone)})`],
    ["Duration", `${b.durationMin} minutes`],
    ["Total", escapeHtml(formatMoney(b.totalCents, b.currency))],
    ["Paid", escapeHtml(formatMoney(b.paidCents - b.refundedCents, b.currency))],
  ];
}

export function manageUrl(b: Booking): string {
  return `${env.appUrl()}/booking/${b.reference}?token=${b.manageToken}`;
}

/** Builds subject + HTML for a booking-related template. */
export function renderBookingEmail(key: TemplateKey, b: BookingFull, settings: Setting, extra: Record<string, string> = {}) {
  const tz = b.clientTimezone || settings.timezone;
  const custom = ((settings.emailTemplates as Record<string, { subject?: string; intro?: string }>) || {})[key] || {};
  const vars: Record<string, string> = {
    ref: b.reference, service: b.service.name, name: b.clientName,
    date: formatInTz(b.startAt, tz, { dateStyle: "medium", timeStyle: "short" }), ...extra,
  };
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  const subject = fill(custom.subject || DEFAULT_SUBJECTS[key]);
  const intros: Partial<Record<TemplateKey, string>> = {
    booking_received: "Thank you for your booking request. Your time slot is reserved while you complete payment.",
    payment_success: "We've received your payment. Thank you!",
    booking_confirmed: "Your meeting is confirmed. We look forward to speaking with you.",
    payment_failed: "Unfortunately your payment did not go through. Your slot is held for a short time — you can try again using the button below.",
    reminder: "This is a friendly reminder about your upcoming meeting.",
    rescheduled: "Your meeting has been moved to a new time. The updated details are below.",
    cancelled: "Your meeting has been cancelled. If a refund applies, you'll receive a separate confirmation.",
    refund_processed: `A refund of ${extra.amount ?? ""} has been processed. It may take 5–10 business days to appear on your statement.`,
    bank_instructions: "Please complete your bank transfer using the details below. Your slot is held until the deadline shown.",
    pending_approval: "We've received your payment. Our team will review your request and confirm your meeting shortly.",
    admin_new_booking: "A new booking has been made.",
    admin_attention: extra.reason || "A booking needs your attention.",
    change_request: `The client has requested: ${extra.request ?? ""}.`,
  };
  const intro = escapeHtml(fill(custom.intro || intros[key] || ""));
  let body = `<p style="margin:0 0 6px;line-height:1.6">Hello ${escapeHtml(key.startsWith("admin") || key === "change_request" ? "team" : b.clientName)},</p><p style="line-height:1.6">${intro}</p>`;
  body += detailsTable(bookingRows(b, key.startsWith("admin") || key === "change_request" ? settings.timezone : tz));
  if (key === "bank_instructions") body += `<div style="padding:14px;background:#FFF8E6;border:1px solid #F3D58C;border-radius:10px;white-space:pre-line;font-size:14px">${escapeHtml(settings.bankInstructions)}\n\nPayment reference: ${escapeHtml(b.reference)}\nAmount: ${escapeHtml(formatMoney(b.dueNowCents, b.currency))}\nPay by: ${escapeHtml(extra.deadline ?? "")}</div>`;
  if ((key === "booking_confirmed" || key === "reminder" || key === "rescheduled") && b.meetingLink?.url) body += button("Join meeting", b.meetingLink.url);
  if ((key === "booking_confirmed" || key === "reminder") && b.meetingLink?.instructions) body += `<p style="line-height:1.6"><strong>Joining instructions:</strong> ${escapeHtml(b.meetingLink.instructions)}</p>`;
  if ((key === "booking_confirmed" || key === "reminder") && !b.meetingLink?.url) body += `<p style="line-height:1.6">Your meeting link will be shared before the meeting.</p>`;
  if (key.startsWith("admin") || key === "change_request") body += button("Open in admin", `${env.appUrl()}/admin/meetings/${b.id}`);
  else if (key === "payment_failed") body += button("Try payment again", `${env.appUrl()}/book/checkout?booking=${b.reference}&token=${b.manageToken}`);
  else body += button("View your booking", manageUrl(b));
  if (key === "booking_confirmed") body += `<p style="font-size:13px;line-height:1.6;color:#5F6E85">Need to change plans? Rescheduling requires ${b.service.rescheduleNoticeHours} hours' notice and cancellation ${b.service.cancelNoticeHours} hours' notice. See our cancellation &amp; refund policy for details.</p>`;
  return { subject, html: layout(settings, subject.replace(/ — .*$/, ""), body) };
}

/** Sends via Resend when configured, otherwise logs. Every message is recorded. */
export async function sendEmail(opts: { to: string; subject: string; html: string; template: string; bookingId?: string | null }) {
  const settings = await getSettings();
  let status = "LOGGED", error: string | null = null;
  if (env.emailConfigured()) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${settings.senderName} <${process.env.EMAIL_FROM}>`, to: [opts.to], subject: opts.subject, html: opts.html }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
      status = "SENT";
    } catch (e) {
      status = "FAILED"; error = e instanceof Error ? e.message : String(e);
    }
  } else if (process.env.NODE_ENV !== "test") {
    console.log(`[email:logged] to=${opts.to} subject="${opts.subject}"`);
  }
  await prisma.notification.create({
    data: { bookingId: opts.bookingId ?? null, template: opts.template, to: opts.to, subject: opts.subject, body: opts.html, status, error },
  });
}

/** Sends a booking email to the client (and/or the admin for admin_* templates). Never throws. */
export async function notifyBooking(bookingId: string, key: TemplateKey, extra: Record<string, string> = {}) {
  try {
    const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { service: true, meetingLink: true } });
    if (!b) return;
    const settings = await getSettings();
    const { subject, html } = renderBookingEmail(key, b, settings, extra);
    const to = key.startsWith("admin") || key === "change_request" ? settings.adminNotifyEmail : b.clientEmail;
    await sendEmail({ to, subject, html, template: key, bookingId: b.id });
  } catch (e) {
    console.error("notifyBooking failed", key, e);
  }
}

export async function sendAccountEmail(key: "verify_email" | "password_reset", to: string, name: string, link: string) {
  const settings = await getSettings();
  const subject = DEFAULT_SUBJECTS[key];
  const text = key === "verify_email"
    ? "Please confirm your email address to activate your account. This link expires in 24 hours."
    : "We received a request to reset your password. This link expires in 1 hour. If you didn't request this, you can ignore this email.";
  const html = layout(settings, subject, `<p style="line-height:1.6">Hello ${escapeHtml(name)},</p><p style="line-height:1.6">${text}</p>${button(key === "verify_email" ? "Verify email" : "Reset password", link)}<p style="font-size:12px;color:#5F6E85;word-break:break-all">${escapeHtml(link)}</p>`);
  await sendEmail({ to, subject, html, template: key });
}
