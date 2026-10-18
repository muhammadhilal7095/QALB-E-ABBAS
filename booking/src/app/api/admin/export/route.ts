import { apiUser, clientIp } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/http";
import { bookingWhere } from "@/lib/admin-filters";

const esc = (v: unknown) => { const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rows: unknown[][]) => rows.map((r) => r.map(esc).join(",")).join("\n");

/** GET /api/admin/export?type=bookings|payments (+ the same filters as the list pages) — CSV download. */
export async function GET(req: Request) {
  const user = await apiUser(["ADMIN", "STAFF"]);
  if (!user) return new Response("Not authorised", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  let body: string;
  if (sp.type === "payments") {
    const ps = await prisma.payment.findMany({ include: { booking: true }, orderBy: { createdAt: "desc" }, take: 10000 });
    body = csv([["Transaction ID", "Payment ref", "Booking ref", "Client", "Email", "Amount", "Currency", "Gateway", "Status", "Refunded", "Paid at", "Created"],
      ...ps.map((p) => [p.gatewayPaymentId ?? p.gatewaySessionId ?? "", p.reference, p.booking.reference, p.booking.clientName, p.booking.clientEmail, (p.amountCents / 100).toFixed(2), p.currency, p.gateway, p.status, (p.refundedCents / 100).toFixed(2), p.paidAt, p.createdAt])]);
  } else {
    const bs = await prisma.booking.findMany({ where: bookingWhere(sp), include: { service: true, assignedTo: true }, orderBy: { startAt: "desc" }, take: 10000 });
    body = csv([["Reference", "Service", "Status", "Payment status", "Start (UTC)", "End (UTC)", "Client", "Email", "Phone", "Company", "Country", "Title", "Purpose", "Total", "Paid", "Refunded", "Currency", "Assigned to", "Created"],
      ...bs.map((b) => [b.reference, b.service.name, b.status, b.paymentStatus, b.startAt, b.endAt, b.clientName, b.clientEmail, b.clientPhone, b.company, b.country, b.title, b.purpose, (b.totalCents / 100).toFixed(2), (b.paidCents / 100).toFixed(2), (b.refundedCents / 100).toFixed(2), b.currency, b.assignedTo?.name ?? "", b.createdAt])]);
  }
  await audit(user.id, "EXPORT", sp.type === "payments" ? "Payment" : "Booking", null, sp, await clientIp());
  return new Response("﻿" + body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="qalb-${sp.type === "payments" ? "payments" : "bookings"}-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
