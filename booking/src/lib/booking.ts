import type { Booking, BookingStatus, Prisma } from "@prisma/client";
import { prisma, isOverlapError, type Db } from "./db";
import { getSettings } from "./settings";
import { getSlots, isSlotAvailable } from "./availability";
import { quoteFor } from "./pricing";
import { dateInTz } from "./tz";
import { makeReference, randomToken } from "./util";
import { notifyBooking } from "./email";

export class BookingError extends Error {
  constructor(message: string, public code: "SLOT_TAKEN" | "INVALID" | "NOT_FOUND" | "STATE" = "INVALID") { super(message); }
}

export async function addEvent(db: Db, bookingId: string, type: string, message: string, actorId?: string | null, data?: Prisma.InputJsonValue) {
  await db.bookingEvent.create({ data: { bookingId, type, message, actorId: actorId ?? null, data } });
}

/** Serialises concurrent writers for the same business date. */
async function lockDate(db: Db, date: string) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"booking-date:" + date}))`;
}

/** Releases checkout holds and unpaid bank-transfer reservations that have timed out. */
export async function expireStaleHolds(db: Db = prisma, now = new Date()): Promise<string[]> {
  const stale = await db.booking.findMany({
    where: { status: { in: ["HELD", "PENDING_PAYMENT"] }, holdExpiresAt: { lt: now }, paidCents: 0 },
    select: { id: true },
  });
  if (!stale.length) return [];
  const ids = stale.map((b) => b.id);
  await db.booking.updateMany({ where: { id: { in: ids } }, data: { status: "EXPIRED", paymentStatus: "CANCELLED" } });
  await db.payment.updateMany({ where: { bookingId: { in: ids }, status: "PENDING" }, data: { status: "CANCELLED", failureReason: "Checkout expired" } });
  await db.bookingEvent.createMany({ data: ids.map((id) => ({ bookingId: id, type: "EXPIRED", message: "Reservation released — checkout was not completed in time." })) });
  return ids;
}

export interface HoldInput {
  serviceId: string;
  startAt: Date;
  clientTimezone: string;
  couponCode?: string | null;
  title: string; purpose: string; description: string;
  questions?: string | null; expectedOutcome?: string | null; notes?: string | null;
  clientName: string; clientEmail: string; clientPhone: string;
  company?: string | null; website?: string | null; country: string;
  commMethod: string; platformPref: string; additionalInfo?: string | null;
  draftToken?: string | null;
}

/**
 * Creates a booking that temporarily reserves the slot during checkout.
 * Price is always recalculated here on the server.
 */
export async function createHold(input: HoldInput, opts: { userId?: string | null; now?: Date } = {}): Promise<Booking> {
  const now = opts.now ?? new Date();
  const settings = await getSettings();
  const service = await prisma.meetingService.findUnique({ where: { id: input.serviceId } });
  if (!service || !service.active) throw new BookingError("This meeting type is not available.", "NOT_FOUND");
  const startAt = input.startAt;
  const endAt = new Date(startAt.getTime() + service.durationMin * 60_000);
  const blockEnd = new Date(endAt.getTime() + settings.bufferMin * 60_000);
  const date = dateInTz(startAt, settings.timezone);

  try {
    return await prisma.$transaction(async (tx) => {
      await lockDate(tx, date);
      await expireStaleHolds(tx, now);
      if (!(await isSlotAvailable(service.durationMin, startAt, { db: tx, now }))) {
        throw new BookingError("Sorry — that time is no longer available. Please choose another slot.", "SLOT_TAKEN");
      }
      const quote = await quoteFor(service, settings, input.couponCode, tx);
      if (quote.couponError) throw new BookingError(quote.couponError);

      const email = input.clientEmail.trim().toLowerCase();
      const client = await tx.client.upsert({
        where: { email },
        update: { name: input.clientName, phone: input.clientPhone, company: input.company, website: input.website, country: input.country, timezone: input.clientTimezone, ...(opts.userId ? { userId: opts.userId } : {}) },
        create: { email, name: input.clientName, phone: input.clientPhone, company: input.company, website: input.website, country: input.country, timezone: input.clientTimezone, userId: opts.userId ?? null },
      });

      const free = quote.dueNowCents === 0;
      const status: BookingStatus = free ? (settings.manualApproval ? "PENDING_APPROVAL" : "CONFIRMED") : "HELD";
      const booking = await tx.booking.create({
        data: {
          reference: makeReference("QA", now), manageToken: randomToken(24),
          serviceId: service.id, clientId: client.id,
          title: input.title, purpose: input.purpose, description: input.description,
          questions: input.questions, expectedOutcome: input.expectedOutcome, notes: input.notes,
          startAt, endAt, blockStart: startAt, blockEnd, durationMin: service.durationMin,
          clientTimezone: input.clientTimezone,
          holdExpiresAt: free ? null : new Date(now.getTime() + settings.holdMinutes * 60_000),
          status, paymentStatus: free ? "PAID" : "UNPAID",
          confirmedAt: status === "CONFIRMED" ? now : null,
          currency: quote.currency, priceCents: quote.priceCents, discountCents: quote.discountCents,
          taxCents: quote.taxCents, totalCents: quote.totalCents, dueNowCents: quote.dueNowCents,
          couponId: quote.coupon?.id ?? null,
          clientName: input.clientName, clientEmail: email, clientPhone: input.clientPhone,
          company: input.company, website: input.website, country: input.country,
          commMethod: input.commMethod, platformPref: input.platformPref, additionalInfo: input.additionalInfo,
          assignedToId: service.assignedToId,
        },
      });
      if (quote.coupon) await tx.coupon.update({ where: { id: quote.coupon.id }, data: { redemptions: { increment: 1 } } });
      if (input.draftToken) await tx.attachment.updateMany({ where: { draftToken: input.draftToken, bookingId: null }, data: { bookingId: booking.id } });
      await addEvent(tx, booking.id, "CREATED", free ? "Booking created (no payment required)." : "Slot reserved — awaiting payment.");
      return booking;
    });
  } catch (e) {
    if (isOverlapError(e)) throw new BookingError("Sorry — that time was just booked by someone else. Please choose another slot.", "SLOT_TAKEN");
    throw e;
  }
}

/** Moves a booking to a new time (admin, or approved client request). */
export async function rescheduleBooking(bookingId: string, newStart: Date, actorId: string | null, opts: { skipAvailabilityRules?: boolean } = {}) {
  const settings = await getSettings();
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b) throw new BookingError("Booking not found.", "NOT_FOUND");
  if (!["CONFIRMED", "PENDING_APPROVAL", "PENDING_PAYMENT", "HELD"].includes(b.status)) throw new BookingError("Only active bookings can be rescheduled.", "STATE");
  const newEnd = new Date(newStart.getTime() + b.durationMin * 60_000);
  const newBlockEnd = new Date(newEnd.getTime() + settings.bufferMin * 60_000);
  try {
    await prisma.$transaction(async (tx) => {
      await lockDate(tx, dateInTz(newStart, settings.timezone));
      if (!opts.skipAvailabilityRules && !(await isSlotAvailable(b.durationMin, newStart, { db: tx, excludeBookingId: b.id }))) {
        throw new BookingError("That time is not available.", "SLOT_TAKEN");
      }
      await tx.booking.update({
        where: { id: b.id },
        data: { startAt: newStart, endAt: newEnd, blockStart: newStart, blockEnd: newBlockEnd, remindersSent: [], changeRequest: "NONE", changeMessage: null },
      });
      await addEvent(tx, b.id, "RESCHEDULED", `Rescheduled from ${b.startAt.toISOString()} to ${newStart.toISOString()}.`, actorId);
    });
  } catch (e) {
    if (isOverlapError(e)) throw new BookingError("That time overlaps another booking.", "SLOT_TAKEN");
    throw e;
  }
  await notifyBooking(b.id, "rescheduled");
}

export async function setStatus(bookingId: string, to: BookingStatus, actorId: string | null, message: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b) throw new BookingError("Booking not found.", "NOT_FOUND");
  const allowed: Record<string, BookingStatus[]> = {
    CONFIRMED: ["PENDING_APPROVAL", "PENDING_PAYMENT", "HELD"],
    COMPLETED: ["CONFIRMED"],
    CANCELLED: ["HELD", "PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED"],
    REJECTED: ["PENDING_APPROVAL", "PENDING_PAYMENT", "HELD"],
  };
  if (!allowed[to]?.includes(b.status)) throw new BookingError(`Cannot change a ${b.status.toLowerCase().replace("_", " ")} booking to ${to.toLowerCase()}.`, "STATE");
  const now = new Date();
  await prisma.booking.update({
    where: { id: b.id },
    data: {
      status: to, holdExpiresAt: null, changeRequest: "NONE",
      ...(to === "CONFIRMED" ? { confirmedAt: now } : {}),
      ...(to === "CANCELLED" || to === "REJECTED" ? { cancelledAt: now } : {}),
      ...(to === "COMPLETED" ? { completedAt: now } : {}),
    },
  });
  await addEvent(prisma, b.id, to, message, actorId);
  if (to === "CONFIRMED") await notifyBooking(b.id, "booking_confirmed");
  if (to === "CANCELLED" || to === "REJECTED") await notifyBooking(b.id, "cancelled");
}

/** Client asks to reschedule or cancel; the team decides in the dashboard. */
export async function requestChange(bookingId: string, kind: "RESCHEDULE" | "CANCEL", message: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b) throw new BookingError("Booking not found.", "NOT_FOUND");
  if (!["CONFIRMED", "PENDING_APPROVAL", "PENDING_PAYMENT"].includes(b.status)) throw new BookingError("This booking can no longer be changed online. Please contact us.", "STATE");
  await prisma.booking.update({ where: { id: b.id }, data: { changeRequest: kind, changeMessage: message.slice(0, 2000) } });
  await addEvent(prisma, b.id, "CHANGE_REQUEST", `Client requested ${kind.toLowerCase()}: ${message.slice(0, 500)}`);
  await notifyBooking(b.id, "change_request", { request: kind === "CANCEL" ? "cancellation" : "rescheduling" });
}

export { getSlots };
