import { prisma } from "@/lib/db";
import { getSlots } from "@/lib/availability";
import { fail, handle, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/slots?serviceId=…&from=ISO&to=ISO — open slots (UTC ISO strings). */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const service = await prisma.meetingService.findFirst({ where: { id: url.searchParams.get("serviceId") ?? "", active: true } });
  if (!service) return fail("Meeting type not found.", 404);
  const from = new Date(url.searchParams.get("from") ?? "");
  const to = new Date(url.searchParams.get("to") ?? "");
  if (isNaN(+from) || isNaN(+to) || to <= from || to.getTime() - from.getTime() > 45 * 86400_000) return fail("Invalid date range.");
  const slots = await getSlots(service.durationMin, from, to);
  return ok({ slots, durationMin: service.durationMin });
});
