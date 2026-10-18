import { prisma, type Db } from "./db";
import type { Setting } from "@prisma/client";

export async function getSettings(db: Db = prisma): Promise<Setting> {
  const s = await db.setting.findUnique({ where: { id: 1 } });
  if (s) return s;
  return db.setting.create({ data: { id: 1 } });
}

export const env = {
  appUrl: () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  mainSiteUrl: () => (process.env.MAIN_SITE_URL || "http://127.0.0.1:8080").replace(/\/$/, ""),
  stripeConfigured: () => !!process.env.STRIPE_SECRET_KEY,
  mockPaymentsEnabled: () => process.env.NODE_ENV !== "production" && process.env.PAYMENT_MOCK_ENABLED === "true",
  emailConfigured: () => !!process.env.RESEND_API_KEY,
};
