import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, clientIp } from "@/lib/auth";
import { audit, fail, handle, ok, parseJson } from "@/lib/http";
import { serviceSchema } from "@/lib/validation";

async function admin() { return apiUser(["ADMIN"]); }

function toData(b: z.output<typeof serviceSchema>) {
  const { price, ...rest } = b;
  return { ...rest, priceCents: Math.round(price * 100) };
}

export const POST = handle(async (req: Request) => {
  const user = await admin(); if (!user) return fail("Admins only.", 403);
  const b = await parseJson(req, serviceSchema);
  if (await prisma.meetingService.findUnique({ where: { slug: b.slug } })) return fail("That slug is already used.", 409);
  const s = await prisma.meetingService.create({ data: toData(b) });
  await audit(user.id, "SERVICE_CREATE", "MeetingService", s.id, { name: s.name }, await clientIp());
  return ok({ id: s.id }, 201);
});

export const PUT = handle(async (req: Request) => {
  const user = await admin(); if (!user) return fail("Admins only.", 403);
  const b = await parseJson(req, serviceSchema.extend({ id: z.string() }));
  const { id, ...rest } = b;
  const clash = await prisma.meetingService.findFirst({ where: { slug: rest.slug, id: { not: id } } });
  if (clash) return fail("That slug is already used.", 409);
  await prisma.meetingService.update({ where: { id }, data: toData(rest) });
  await audit(user.id, "SERVICE_UPDATE", "MeetingService", id, { name: rest.name, price: rest.price }, await clientIp());
  return ok({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const user = await admin(); if (!user) return fail("Admins only.", 403);
  const { id } = await parseJson(req, z.object({ id: z.string() }));
  const used = await prisma.booking.count({ where: { serviceId: id } });
  if (used) {
    await prisma.meetingService.update({ where: { id }, data: { active: false } });
    await audit(user.id, "SERVICE_DEACTIVATE", "MeetingService", id, undefined, await clientIp());
    return ok({ deactivated: true, message: "This service has bookings, so it was deactivated instead of deleted." });
  }
  await prisma.meetingService.delete({ where: { id } });
  await audit(user.id, "SERVICE_DELETE", "MeetingService", id, undefined, await clientIp());
  return ok({ deleted: true });
});
