import { z } from "zod";
import { prisma } from "@/lib/db";
import { requestChange } from "@/lib/booking";
import { fail, handle, ok, parseJson, rateLimit } from "@/lib/http";
import { clientIp, getCurrentUser } from "@/lib/auth";

const schema = z.object({ token: z.string().optional(), kind: z.enum(["RESCHEDULE", "CANCEL"]), message: z.string().trim().min(5, "Please add a short message.").max(2000) });

/** POST /api/bookings/:ref/request — client requests a reschedule or cancellation. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ ref: string }> }) => {
  await rateLimit(`req:${await clientIp()}`, 10, 3600);
  const { ref } = await ctx.params;
  const body = await parseJson(req, schema);
  const b = await prisma.booking.findUnique({ where: { reference: ref }, include: { client: true } });
  const user = await getCurrentUser();
  const owner = b && ((body.token && body.token === b.manageToken) || (user && b.client.userId === user.id));
  if (!b || !owner) return fail("Booking not found.", 404);
  await requestChange(b.id, body.kind, body.message);
  return ok({ ok: true });
});
