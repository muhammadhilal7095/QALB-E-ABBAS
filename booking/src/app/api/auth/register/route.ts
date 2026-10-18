import { prisma } from "@/lib/db";
import { hashPassword, passwordProblem, sendVerification, clientIp } from "@/lib/auth";
import { fail, handle, ok, parseJson, rateLimit } from "@/lib/http";
import { registerSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  await rateLimit(`register:${await clientIp()}`, 5, 3600);
  const body = await parseJson(req, registerSchema);
  const problem = passwordProblem(body.password);
  if (problem) return fail(problem, 422);
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    // Don't reveal whether the address is registered; resend verification if needed.
    if (!existing.emailVerifiedAt) await sendVerification(existing);
    return ok({ ok: true });
  }
  const user = await prisma.user.create({ data: { email: body.email, name: body.name, passwordHash: await hashPassword(body.password), role: "CLIENT" } });
  await prisma.client.upsert({ where: { email: body.email }, update: { userId: user.id }, create: { email: body.email, name: body.name, userId: user.id } });
  await sendVerification(user);
  return ok({ ok: true }, 201);
});
