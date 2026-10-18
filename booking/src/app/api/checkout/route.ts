import { z } from "zod";
import { prisma } from "@/lib/db";
import { startCheckout } from "@/lib/payments";
import { fail, handle, ok, parseJson, rateLimit } from "@/lib/http";
import { clientIp, getCurrentUser } from "@/lib/auth";

const schema = z.object({ reference: z.string(), token: z.string().optional(), gateway: z.enum(["STRIPE", "BANK_TRANSFER", "MOCK"]) });

/** POST /api/checkout — starts payment for a held booking; returns the redirect URL. */
export const POST = handle(async (req: Request) => {
  await rateLimit(`checkout:${await clientIp()}`, 20, 600);
  const body = await parseJson(req, schema);
  const b = await prisma.booking.findUnique({ where: { reference: body.reference }, include: { client: true } });
  const user = await getCurrentUser();
  if (!b || !((body.token && body.token === b.manageToken) || (user && b.client.userId === user.id))) return fail("Booking not found.", 404);
  const { redirectUrl } = await startCheckout(b, body.gateway);
  return ok({ redirectUrl });
});
