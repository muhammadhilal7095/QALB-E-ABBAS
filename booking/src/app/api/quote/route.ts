import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { quoteFor } from "@/lib/pricing";
import { fail, handle, ok, parseJson, rateLimit } from "@/lib/http";
import { quoteSchema } from "@/lib/validation";
import { clientIp } from "@/lib/auth";

/** POST /api/quote — server-side price calculation (incl. coupon & tax). */
export const POST = handle(async (req: Request) => {
  await rateLimit(`quote:${await clientIp()}`, 60, 600);
  const body = await parseJson(req, quoteSchema);
  const service = await prisma.meetingService.findFirst({ where: { id: body.serviceId, active: true } });
  if (!service) return fail("Meeting type not found.", 404);
  const quote = await quoteFor(service, await getSettings(), body.couponCode);
  return ok({ quote });
});
