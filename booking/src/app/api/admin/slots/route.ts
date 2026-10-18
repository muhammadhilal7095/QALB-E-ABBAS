import { prisma } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { getSlots } from "@/lib/availability";
import { fail, handle, ok } from "@/lib/http";

/** GET /api/admin/slots?bookingId&from&to — slots for rescheduling (ignores the booking itself). */
export const GET = handle(async (req: Request) => {
  if (!(await apiUser(["ADMIN", "STAFF"]))) return fail("Not authorised.", 403);
  const u = new URL(req.url);
  const b = await prisma.booking.findUnique({ where: { id: u.searchParams.get("bookingId") ?? "" } });
  if (!b) return fail("Booking not found.", 404);
  const from = new Date(u.searchParams.get("from") ?? ""), to = new Date(u.searchParams.get("to") ?? "");
  if (isNaN(+from) || isNaN(+to) || to <= from) return fail("Invalid range.");
  return ok({ slots: await getSlots(b.durationMin, from, to, { excludeBookingId: b.id }) });
});
