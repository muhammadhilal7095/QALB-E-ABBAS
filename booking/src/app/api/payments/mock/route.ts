import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/settings";
import { cancelPayment, failPayment, fulfillPayment } from "@/lib/payments";
import { fail, handle, ok, parseJson } from "@/lib/http";

const schema = z.object({ paymentId: z.string(), outcome: z.enum(["succeed", "fail", "cancel"]) });

/** DEVELOPMENT ONLY — simulates a gateway result for testing the full journey. */
export const POST = handle(async (req: Request) => {
  if (!env.mockPaymentsEnabled()) return fail("Not available.", 404);
  const body = await parseJson(req, schema);
  const p = await prisma.payment.findUnique({ where: { id: body.paymentId }, include: { booking: true } });
  if (!p || p.gateway !== "MOCK") return fail("Payment not found.", 404);
  const back = `${env.appUrl()}/booking/${p.booking.reference}?token=${p.booking.manageToken}`;
  if (body.outcome === "succeed") await fulfillPayment(p.id, { gatewayPaymentId: `mock_${p.id}`, amountCents: p.amountCents });
  if (body.outcome === "fail") { await failPayment(p.id, "Simulated card decline"); return ok({ redirectUrl: `${env.appUrl()}/book/checkout?booking=${p.booking.reference}&token=${p.booking.manageToken}&failed=1` }); }
  if (body.outcome === "cancel") { await cancelPayment(p.id, "Cancelled by client", false); return ok({ redirectUrl: `${env.appUrl()}/book/checkout?booking=${p.booking.reference}&token=${p.booking.manageToken}&cancelled=1` }); }
  return ok({ redirectUrl: back });
});
