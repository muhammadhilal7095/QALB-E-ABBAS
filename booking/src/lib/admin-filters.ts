import type { Prisma } from "@prisma/client";

/** Shared booking filters for the admin list, calendar and CSV export. */
export function bookingWhere(sp: Record<string, string | undefined>): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {};
  if (sp.q) where.OR = [
    { clientName: { contains: sp.q, mode: "insensitive" } }, { clientEmail: { contains: sp.q, mode: "insensitive" } },
    { reference: { contains: sp.q, mode: "insensitive" } }, { title: { contains: sp.q, mode: "insensitive" } }, { company: { contains: sp.q, mode: "insensitive" } },
  ];
  if (sp.service) where.serviceId = sp.service;
  if (sp.status) where.status = sp.status as Prisma.BookingWhereInput["status"];
  else if (sp.hideExpired !== "0") where.status = { notIn: ["EXPIRED"] };
  if (sp.payment) where.paymentStatus = sp.payment as Prisma.BookingWhereInput["paymentStatus"];
  if (sp.assigned) where.assignedToId = sp.assigned;
  if (sp.request === "1") where.changeRequest = { not: "NONE" };
  const from = sp.from ? new Date(sp.from) : null, to = sp.to ? new Date(sp.to) : null;
  if ((from && !isNaN(+from)) || (to && !isNaN(+to))) where.startAt = { ...(from && !isNaN(+from) ? { gte: from } : {}), ...(to && !isNaN(+to) ? { lt: new Date(to.getTime() + 86400_000) } : {}) };
  return where;
}
