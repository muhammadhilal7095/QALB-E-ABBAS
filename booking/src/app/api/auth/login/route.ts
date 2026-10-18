import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword, clientIp } from "@/lib/auth";
import { audit, fail, handle, ok, parseJson, rateLimit } from "@/lib/http";

const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200), admin: z.boolean().optional() });
let DUMMY: string | null = null; // decoy hash so unknown emails take as long as wrong passwords

export const POST = handle(async (req: Request) => {
  const ip = await clientIp();
  await rateLimit(`login:${ip}`, 10, 900);
  const body = await parseJson(req, schema);
  await rateLimit(`login-user:${body.email}`, 8, 900);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  DUMMY ??= await bcrypt.hash("decoy-password", 12);
  const valid = await verifyPassword(body.password, user?.passwordHash ?? DUMMY);
  if (!user || !valid || !user.active) return fail("Incorrect email or password.", 401);
  if (body.admin && user.role === "CLIENT") return fail("This account does not have admin access.", 403);
  if (!user.emailVerifiedAt) return fail("Please verify your email address first — check your inbox for the link.", 403, { unverified: true });
  await createSession(user.id);
  if (user.role !== "CLIENT") await audit(user.id, "LOGIN", "User", user.id, undefined, ip);
  return ok({ role: user.role });
});
