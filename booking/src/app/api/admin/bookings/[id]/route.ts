import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, clientIp } from "@/lib/auth";
import { addEvent, rescheduleBooking, setStatus, BookingError } from "@/lib/booking";
import { recordManualPayment } from "@/lib/payments";
import { notifyBooking } from "@/lib/email";
import { audit, fail, handle, ok, parseJson } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { labelToMinutes, zonedToUtc } from "@/lib/tz";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("cancel"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("reschedule"), startAt: z.string().datetime().optional(), localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), localTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), override: z.boolean().optional() }),
  z.object({ action: z.literal("assign"), userId: z.string().nullable() }),
  z.object({ action: z.literal("link"), platform: z.enum(["GOOGLE_MEET", "ZOOM", "TEAMS", "CUSTOM", "PHONE", "IN_PERSON"]), url: z.string().trim().url().or(z.literal("")).optional(), instructions: z.string().max(2000).optional(), notify: z.boolean().optional() }),
  z.object({ action: z.literal("note"), body: z.string().trim().min(1).max(5000) }),
  z.object({ action: z.literal("markPaid") }),
  z.object({ action: z.literal("clearRequest") }),
]);

/** POST /api/admin/bookings/:id — meeting management actions (staff & admin). */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser(["ADMIN", "STAFF"]);
  if (!user) return fail("Not authorised.", 403);
  const { id } = await ctx.params;
  const body = await parseJson(req, schema);
  const b = await prisma.booking.findUnique({ where: { id } });
  if (!b) return fail("Booking not found.", 404);
  const ip = await clientIp();

  switch (body.action) {
    case "confirm": case "approve":
      if (b.dueNowCents > 0 && b.paidCents === 0 && body.action === "approve") throw new BookingError("This booking has not been paid yet.", "STATE");
      await setStatus(id, "CONFIRMED", user.id, body.action === "approve" ? "Approved by team." : "Confirmed by team."); break;
    case "reject": await setStatus(id, "REJECTED", user.id, `Rejected${body.reason ? `: ${body.reason}` : ""}.`); break;
    case "cancel": await setStatus(id, "CANCELLED", user.id, `Cancelled by team${body.reason ? `: ${body.reason}` : ""}.`); break;
    case "complete": await setStatus(id, "COMPLETED", user.id, "Marked as completed."); break;
    case "reschedule": {
      // Either an exact UTC slot, or a wall-clock date/time in the business time zone.
      const tz = (await getSettings()).timezone;
      const start = body.startAt ? new Date(body.startAt) : body.localDate && body.localTime ? zonedToUtc(body.localDate, labelToMinutes(body.localTime), tz) : null;
      if (!start) return fail("Choose a new time.");
      await rescheduleBooking(id, start, user.id, { skipAvailabilityRules: !!body.override && user.role === "ADMIN" }); break;
    }
    case "assign": {
      if (body.userId && !(await prisma.user.findFirst({ where: { id: body.userId, role: { in: ["ADMIN", "STAFF"] } } }))) return fail("Unknown team member.");
      await prisma.booking.update({ where: { id }, data: { assignedToId: body.userId } });
      await addEvent(prisma, id, "ASSIGNED", body.userId ? "Assigned to a team member." : "Unassigned.", user.id); break;
    }
    case "link": {
      await prisma.meetingLink.upsert({ where: { bookingId: id }, update: { platform: body.platform, url: body.url || null, instructions: body.instructions || null }, create: { bookingId: id, platform: body.platform, url: body.url || null, instructions: body.instructions || null } });
      await addEvent(prisma, id, "MEETING_LINK", "Meeting link updated.", user.id);
      if (body.notify && b.status === "CONFIRMED") await notifyBooking(id, "booking_confirmed");
      break;
    }
    case "note": await prisma.internalNote.create({ data: { bookingId: id, authorId: user.id, body: body.body } }); break;
    case "markPaid":
      if (user.role !== "ADMIN") return fail("Only admins can record payments.", 403);
      await recordManualPayment(id, user.id); break;
    case "clearRequest":
      await prisma.booking.update({ where: { id }, data: { changeRequest: "NONE" } });
      await addEvent(prisma, id, "REQUEST_CLOSED", "Client request marked as handled.", user.id); break;
  }
  await audit(user.id, `BOOKING_${body.action.toUpperCase()}`, "Booking", id, body.action === "note" ? undefined : (body as object as never), ip);
  return ok({ ok: true });
});
