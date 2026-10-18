import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, clientIp, hashPassword, passwordProblem } from "@/lib/auth";
import { audit, fail, handle, ok, parseJson } from "@/lib/http";

/** Team management — admin only. */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(["ADMIN"]); if (!user) return fail("Admins only.", 403);
  const b = await parseJson(req, z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email(), role: z.enum(["ADMIN", "STAFF"]), password: z.string().max(200) }));
  const p = passwordProblem(b.password); if (p) return fail(p, 422);
  if (await prisma.user.findUnique({ where: { email: b.email } })) return fail("A user with that email already exists.", 409);
  const u = await prisma.user.create({ data: { name: b.name, email: b.email, role: b.role, passwordHash: await hashPassword(b.password), emailVerifiedAt: new Date() } });
  await audit(user.id, "USER_CREATE", "User", u.id, { email: b.email, role: b.role }, await clientIp());
  return ok({ id: u.id }, 201);
});

export const PUT = handle(async (req: Request) => {
  const user = await apiUser(["ADMIN"]); if (!user) return fail("Admins only.", 403);
  const b = await parseJson(req, z.object({ id: z.string(), active: z.boolean().optional(), role: z.enum(["ADMIN", "STAFF"]).optional() }));
  if (b.id === user.id) return fail("You can't change your own access.", 400);
  await prisma.user.update({ where: { id: b.id }, data: { ...(b.active !== undefined ? { active: b.active } : {}), ...(b.role ? { role: b.role } : {}) } });
  if (b.active === false) await prisma.session.deleteMany({ where: { userId: b.id } });
  await audit(user.id, "USER_UPDATE", "User", b.id, { active: b.active, role: b.role }, await clientIp());
  return ok({ ok: true });
});
