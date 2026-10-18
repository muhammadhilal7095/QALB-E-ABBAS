import { z } from "zod";
import { prisma } from "@/lib/db";
import { consumeToken, hashPassword, passwordProblem, clientIp } from "@/lib/auth";
import { fail, handle, ok, parseJson, rateLimit } from "@/lib/http";

export const POST = handle(async (req: Request) => {
  await rateLimit(`reset:${await clientIp()}`, 10, 3600);
  const { token, password } = await parseJson(req, z.object({ token: z.string().min(10), password: z.string().max(200) }));
  const problem = passwordProblem(password);
  if (problem) return fail(problem, 422);
  const t = await consumeToken(token, "PASSWORD_RESET");
  if (!t) return fail("This reset link is invalid or has expired. Please request a new one.", 400);
  await prisma.user.update({ where: { id: t.userId }, data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date() } });
  await prisma.session.deleteMany({ where: { userId: t.userId } }); // sign out everywhere
  return ok({ ok: true });
});
