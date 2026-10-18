import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, clientIp } from "@/lib/auth";
import { audit, fail, handle, ok, parseJson } from "@/lib/http";
import { isValidTimeZone } from "@/lib/tz";

const range = z.object({ startMinute: z.number().int().min(0).max(1440), endMinute: z.number().int().min(0).max(1440) }).refine((r) => r.endMinute > r.startMinute, "End must be after start.");
const schema = z.object({
  workingHours: z.array(range.and(z.object({ weekday: z.number().int().min(0).max(6) }))).max(50),
  breaks: z.array(range.and(z.object({ weekday: z.number().int().min(0).max(6).nullable(), label: z.string().max(60).optional() }))).max(50),
  rules: z.object({
    timezone: z.string().refine(isValidTimeZone, "Invalid time zone."),
    slotStepMin: z.number().int().refine((n) => [5, 10, 15, 20, 30, 60].includes(n)),
    bufferMin: z.number().int().min(0).max(240),
    minNoticeHours: z.number().int().min(0).max(720),
    maxDaysAhead: z.number().int().min(1).max(730),
    maxPerDay: z.number().int().min(1).max(100),
    holdMinutes: z.number().int().min(10).max(240),
    bankHoldHours: z.number().int().min(1).max(336),
  }),
});

/** PUT /api/admin/availability — weekly hours, breaks and booking rules (admin only). */
export const PUT = handle(async (req: Request) => {
  const user = await apiUser(["ADMIN"]); if (!user) return fail("Admins only.", 403);
  const b = await parseJson(req, schema);
  await prisma.$transaction([
    prisma.workingHours.deleteMany(),
    prisma.workingHours.createMany({ data: b.workingHours }),
    prisma.breakTime.deleteMany(),
    prisma.breakTime.createMany({ data: b.breaks.map((x) => ({ weekday: x.weekday, startMinute: x.startMinute, endMinute: x.endMinute, label: x.label ?? null })) }),
    prisma.setting.update({ where: { id: 1 }, data: b.rules }),
  ]);
  await audit(user.id, "AVAILABILITY_UPDATE", "Setting", "1", b.rules, await clientIp());
  return ok({ ok: true });
});
