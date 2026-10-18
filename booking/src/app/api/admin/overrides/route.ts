import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, clientIp } from "@/lib/auth";
import { audit, fail, handle, ok, parseJson } from "@/lib/http";

/** Holidays / leave (closed) or custom hours for a date. Admin only. */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(["ADMIN"]); if (!user) return fail("Admins only.", 403);
  const b = await parseJson(req, z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    closed: z.boolean(), startMinute: z.number().int().min(0).max(1440).nullable().optional(), endMinute: z.number().int().min(0).max(1440).nullable().optional(), note: z.string().max(200).optional(),
  }));
  if (!b.closed && (b.startMinute == null || b.endMinute == null || b.endMinute <= b.startMinute)) return fail("Enter valid custom hours.");
  const dates: string[] = [];
  for (let d = b.date; d <= (b.toDate || b.date) && dates.length < 366; ) {
    dates.push(d);
    const [y, m, dd] = d.split("-").map(Number);
    d = new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10);
  }
  for (const date of dates) {
    const data = { closed: b.closed, startMinute: b.closed ? null : b.startMinute!, endMinute: b.closed ? null : b.endMinute!, note: b.note ?? null };
    await prisma.dateOverride.upsert({ where: { date }, update: data, create: { date, ...data } });
  }
  await audit(user.id, "OVERRIDE_SET", "DateOverride", dates.join(","), { closed: b.closed }, await clientIp());
  return ok({ ok: true, count: dates.length });
});

export const DELETE = handle(async (req: Request) => {
  const user = await apiUser(["ADMIN"]); if (!user) return fail("Admins only.", 403);
  const { id } = await parseJson(req, z.object({ id: z.string() }));
  await prisma.dateOverride.delete({ where: { id } });
  await audit(user.id, "OVERRIDE_DELETE", "DateOverride", id, undefined, await clientIp());
  return ok({ ok: true });
});
