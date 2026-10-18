import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, clientIp } from "@/lib/auth";
import { audit, fail, handle, ok, parseJson } from "@/lib/http";

const schema = z.object({
  businessName: z.string().trim().min(2).max(120),
  logoUrl: z.string().trim().url().or(z.literal("")).optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  taxRatePercent: z.number().min(0).max(50),
  taxLabel: z.string().trim().min(1).max(30),
  allowGuestBooking: z.boolean(),
  manualApproval: z.boolean(),
  stripeEnabled: z.boolean(),
  bankEnabled: z.boolean(),
  bankInstructions: z.string().max(3000),
  reminderHours: z.array(z.number().int().min(1).max(168)).max(5),
  senderName: z.string().trim().min(2).max(80),
  adminNotifyEmail: z.string().trim().email(),
  emailFooter: z.string().max(500),
  emailTemplates: z.record(z.object({ subject: z.string().max(200).optional(), intro: z.string().max(2000).optional() })),
  cancellationPolicy: z.string().max(10000),
  refundPolicy: z.string().max(10000),
});

/** PUT /api/admin/settings — admin only. */
export const PUT = handle(async (req: Request) => {
  const user = await apiUser(["ADMIN"]); if (!user) return fail("Admins only.", 403);
  const b = await parseJson(req, schema);
  await prisma.setting.update({ where: { id: 1 }, data: { ...b, logoUrl: b.logoUrl || null, reminderHours: [...new Set(b.reminderHours)].sort((x, y) => y - x) } });
  await audit(user.id, "SETTINGS_UPDATE", "Setting", "1", { manualApproval: b.manualApproval, stripeEnabled: b.stripeEnabled, bankEnabled: b.bankEnabled, taxRatePercent: b.taxRatePercent }, await clientIp());
  return ok({ ok: true });
});
