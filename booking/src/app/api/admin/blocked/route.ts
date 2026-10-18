import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, clientIp } from "@/lib/auth";
import { audit, fail, handle, ok, parseJson } from "@/lib/http";

/** Emergency blocking of specific time ranges (staff & admin). */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(["ADMIN", "STAFF"]); if (!user) return fail("Not authorised.", 403);
  const b = await parseJson(req, z.object({ startAt: z.string().datetime(), endAt: z.string().datetime(), reason: z.string().max(200).optional() }));
  if (new Date(b.endAt) <= new Date(b.startAt)) return fail("End must be after start.");
  const s = await prisma.blockedSlot.create({ data: { startAt: new Date(b.startAt), endAt: new Date(b.endAt), reason: b.reason ?? null } });
  await audit(user.id, "BLOCK_CREATE", "BlockedSlot", s.id, b, await clientIp());
  return ok({ id: s.id }, 201);
});

export const DELETE = handle(async (req: Request) => {
  const user = await apiUser(["ADMIN", "STAFF"]); if (!user) return fail("Not authorised.", 403);
  const { id } = await parseJson(req, z.object({ id: z.string() }));
  await prisma.blockedSlot.delete({ where: { id } });
  await audit(user.id, "BLOCK_DELETE", "BlockedSlot", id, undefined, await clientIp());
  return ok({ ok: true });
});
