import { randomBytes } from "node:crypto";

// One random secret per server process, shared by every route (Next bundles routes separately).
const g = globalThis as unknown as { __qaTestSecret?: string };
const devSecret = (g.__qaTestSecret ??= randomBytes(32).toString("hex"));

/** All configuration comes from environment variables (see .env.example). */
export const env = {
  appUrl: () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  mainSiteUrl: () => (process.env.MAIN_SITE_URL || "http://localhost:8080").replace(/\/$/, ""),
  adminEmail: () => process.env.ADMIN_EMAIL || "contact@qalbeabbas.com",
  businessName: () => process.env.BUSINESS_NAME || "Qalb-E-Abbas",
  stripeConfigured: () => !!process.env.STRIPE_SECRET_KEY,
  /** Development-only test checkout (no real money). Never available in production. */
  testPaymentsEnabled: () => process.env.NODE_ENV !== "production" && process.env.PAYMENT_MOCK_ENABLED === "true",
  emailConfigured: () => !!process.env.RESEND_API_KEY,
  emailFrom: () => process.env.EMAIL_FROM || "bookings@qalbeabbas.com",
  /** Signs test-checkout data; a fresh random secret per run is fine for development. */
  testSecret: () => process.env.TEST_PAYMENT_SECRET || devSecret,
};
