import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, clientIp } from "@/lib/auth";
import { BookingError } from "@/lib/booking";
import { recordOrderBankPayment } from "@/lib/orders";
import { audit, fail, handle, ok, parseJson } from "@/lib/http";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("markPaid") }),
  z.object({ action: z.literal("status"), status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]) }),
]);

/** POST /api/admin/orders/:id — order management (staff & admin). */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser(["ADMIN", "STAFF"]);
  if (!user) return fail("Not authorised.", 403);
  const { id } = await ctx.params;
  const body = await parseJson(req, schema);
  const o = await prisma.order.findUnique({ where: { id } });
  if (!o) return fail("Order not found.", 404);
  if (body.action === "markPaid") {
    await recordOrderBankPayment(id);
  } else {
    if (body.status !== "CANCELLED" && o.status === "PENDING_PAYMENT") throw new BookingError("This order has not been paid yet.", "STATE");
    if (o.status === "CANCELLED" || o.status === "REFUNDED") throw new BookingError("This order is already closed.", "STATE");
    await prisma.order.update({ where: { id }, data: { status: body.status } });
    if (body.status === "CANCELLED") await prisma.orderPayment.updateMany({ where: { orderId: id, status: "PENDING" }, data: { status: "CANCELLED", failureReason: "Order cancelled" } });
  }
  await audit(user.id, `order.${body.action === "markPaid" ? "markPaid" : body.status.toLowerCase()}`, "Order", id, undefined, await clientIp());
  return ok({ ok: true });
});
