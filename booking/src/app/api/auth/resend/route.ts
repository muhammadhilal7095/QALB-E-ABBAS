import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendVerification, clientIp } from "@/lib/auth";
import { handle, ok, parseJson, rateLimit } from "@/lib/http";

export const POST = handle(async (req: Request) => {
  await rateLimit(`resend:${await clientIp()}`, 5, 3600);
  const { email } = await parseJson(req, z.object({ email: z.string().trim().toLowerCase().email() }));
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerifiedAt) await sendVerification(user);
  return ok({ ok: true });
});
