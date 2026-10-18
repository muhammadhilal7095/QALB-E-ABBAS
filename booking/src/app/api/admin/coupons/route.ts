import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, clientIp } from "@/lib/auth";
import { audit, fail, handle, ok, parseJson } from "@/lib/http";

export const POST = handle(async (req: Request) => {
  const user = await apiUser(["ADMIN"]); if (!user) return fail("Admins only.", 403);
  const b = await parseJson(req, z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, "Code: 3–40 letters, numbers, - or _."),
    percentOff: z.number().int().min(1).max(100).nullable().optional(), amountOff: z.number().positive().nullable().optional(),
    maxRedemptions: z.number().int().positive().nullable().optional(), validTo: z.string().nullable().optional(),
  }));
  if (!b.percentOff === !b.amountOff) return fail("Set either a percentage or a fixed amount.");
  if (await prisma.coupon.findUnique({ where: { code: b.code } })) return fail("That code already exists.", 409);
  const c = await prisma.coupon.create({ data: { code: b.code, percentOff: b.percentOff ?? null, amountOffCents: b.amountOff ? Math.round(b.amountOff * 100) : null, maxRedemptions: b.maxRedemptions ?? null, validTo: b.validTo ? new Date(b.validTo) : null } });
  await audit(user.id, "COUPON_CREATE", "Coupon", c.id, { code: c.code }, await clientIp());
  return ok({ id: c.id }, 201);
});

export const PUT = handle(async (req: Request) => {
  const user = await apiUser(["ADMIN"]); if (!user) return fail("Admins only.", 403);
  const b = await parseJson(req, z.object({ id: z.string(), active: z.boolean() }));
  await prisma.coupon.update({ where: { id: b.id }, data: { active: b.active } });
  await audit(user.id, "COUPON_TOGGLE", "Coupon", b.id, { active: b.active }, await clientIp());
  return ok({ ok: true });
});
