import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/settings";
import { cancelOrderPayment, failOrderPayment, fulfillOrderPayment, orderUrl } from "@/lib/orders";
import { fail, handle, ok, parseJson } from "@/lib/http";

const schema = z.object({ paymentId: z.string(), outcome: z.enum(["succeed", "fail", "cancel"]) });

/** DEVELOPMENT ONLY — simulates a gateway result for an order payment. */
export const POST = handle(async (req: Request) => {
  if (!env.mockPaymentsEnabled()) return fail("Not available.", 404);
  const body = await parseJson(req, schema);
  const p = await prisma.orderPayment.findUnique({ where: { id: body.paymentId }, include: { order: true } });
  if (!p || p.gateway !== "MOCK") return fail("Payment not found.", 404);
  if (body.outcome === "succeed") await fulfillOrderPayment(p.id, { gatewayPaymentId: `mock_${p.id}`, amountCents: p.amountCents });
  if (body.outcome === "fail") { await failOrderPayment(p.id, "Simulated card decline"); return ok({ redirectUrl: `${orderUrl(p.order)}&failed=1` }); }
  if (body.outcome === "cancel") { await cancelOrderPayment(p.id, "Cancelled by client"); return ok({ redirectUrl: `${orderUrl(p.order)}&cancelled=1` }); }
  return ok({ redirectUrl: orderUrl(p.order) });
});
