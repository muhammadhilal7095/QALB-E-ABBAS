import { z } from "zod";
import { apiUser, clientIp } from "@/lib/auth";
import { refundPayment } from "@/lib/payments";
import { audit, fail, handle, ok, parseJson } from "@/lib/http";

/** POST /api/admin/payments/:id/refund — admin only. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser(["ADMIN"]);
  if (!user) return fail("Only admins can issue refunds.", 403);
  const { id } = await ctx.params;
  const { amount, reason } = await parseJson(req, z.object({ amount: z.coerce.number().positive(), reason: z.string().trim().max(500).default("") }));
  const cents = Math.round(amount * 100);
  await refundPayment(id, cents, reason, user.id);
  await audit(user.id, "REFUND", "Payment", id, { amountCents: cents, reason }, await clientIp());
  return ok({ ok: true });
});
