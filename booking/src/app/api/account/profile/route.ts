import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { fail, handle, ok, parseJson } from "@/lib/http";
import { phoneSchema } from "@/lib/validation";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema.or(z.literal("")).optional(),
  company: z.string().trim().max(150).optional(),
  website: z.string().trim().max(300).optional().refine((v) => !v || /^https?:\/\//i.test(v), "Website must start with http:// or https://"),
  country: z.string().trim().max(80).optional(),
});

export const PUT = handle(async (req: Request) => {
  const user = await apiUser(["CLIENT"]);
  if (!user) return fail("Please sign in.", 401);
  const b = await parseJson(req, schema);
  await prisma.user.update({ where: { id: user.id }, data: { name: b.name } });
  await prisma.client.upsert({
    where: { email: user.email },
    update: { name: b.name, phone: b.phone || null, company: b.company || null, website: b.website || null, country: b.country || null, userId: user.id },
    create: { email: user.email, name: b.name, phone: b.phone || null, company: b.company || null, website: b.website || null, country: b.country || null, userId: user.id },
  });
  return ok({ ok: true });
});
