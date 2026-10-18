import { createHold } from "@/lib/booking";
import { notifyBooking } from "@/lib/email";
import { handle, ok, parseJson, rateLimit } from "@/lib/http";
import { holdSchema } from "@/lib/validation";
import { clientIp, getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { fail } from "@/lib/http";

/** POST /api/bookings — validates, re-prices and temporarily reserves the slot. */
export const POST = handle(async (req: Request) => {
  await rateLimit(`book:${await clientIp()}`, 10, 600);
  const body = await parseJson(req, holdSchema);
  const user = await getCurrentUser();
  const settings = await getSettings();
  if (!settings.allowGuestBooking && !user) return fail("Please sign in or create an account to book.", 401);
  const booking = await createHold({ ...body, startAt: new Date(body.startAt) }, { userId: user?.role === "CLIENT" ? user.id : null });
  if (booking.status === "HELD") {
    await notifyBooking(booking.id, "booking_received");
  } else {
    await notifyBooking(booking.id, booking.status === "CONFIRMED" ? "booking_confirmed" : "pending_approval");
    await notifyBooking(booking.id, "admin_new_booking");
  }
  return ok({ reference: booking.reference, token: booking.manageToken, status: booking.status }, 201);
});
