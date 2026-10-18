import { z } from "zod";
import { prisma } from "@/lib/db";
import { startOrderCheckout } from "@/lib/orders";
import { fail, handle, ok, parseJson, rateLimit } from "@/lib/http";
import { clientIp } from "@/lib/auth";

const schema = z.object({ token: z.string(), gateway: z.enum(["STRIPE", "BANK_TRANSFER", "MOCK"]) });

/** POST /api/orders/:ref/pay — retry payment for an unpaid order (from the order page). */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ ref: string }> }) => {
  await rateLimit(`order-pay:${await clientIp()}`, 20, 600);
  const { ref } = await ctx.params;
  const body = await parseJson(req, schema);
  const order = await prisma.order.findUnique({ where: { reference: ref }, include: { items: true } });
  if (!order || order.accessToken !== body.token) return fail("Order not found.", 404);
  return ok(await startOrderCheckout(order, body.gateway));
});
