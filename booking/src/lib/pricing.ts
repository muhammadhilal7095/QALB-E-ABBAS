import type { Coupon, MeetingService, Setting } from "@prisma/client";
import { prisma, type Db } from "./db";

export interface Quote {
  currency: string;
  priceCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  dueNowCents: number;
  taxLabel: string;
  taxRatePercent: number;
  coupon: { id: string; code: string } | null;
  couponError: string | null;
  paymentRequirement: MeetingService["paymentRequirement"];
  depositPercent: number;
}

export function couponProblem(c: Coupon | null, serviceId: string, now = new Date()): string | null {
  if (!c || !c.active) return "This coupon code is not valid.";
  if (c.validFrom && c.validFrom > now) return "This coupon is not active yet.";
  if (c.validTo && c.validTo < now) return "This coupon has expired.";
  if (c.maxRedemptions != null && c.redemptions >= c.maxRedemptions) return "This coupon has reached its usage limit.";
  if (c.serviceId && c.serviceId !== serviceId) return "This coupon does not apply to the selected meeting.";
  return null;
}

/** Pure price calculation — the single source of truth for amounts. */
export function calculateQuote(service: MeetingService, settings: Setting, coupon: Coupon | null, couponError: string | null = null): Quote {
  const price = service.priceCents;
  let discount = 0;
  if (coupon && !couponError) {
    if (coupon.percentOff) discount = Math.round((price * Math.min(100, coupon.percentOff)) / 100);
    else if (coupon.amountOffCents) discount = Math.min(price, coupon.amountOffCents);
  }
  const taxable = price - discount;
  const tax = Math.round((taxable * settings.taxRatePercent) / 100);
  const total = taxable + tax;
  const due =
    service.paymentRequirement === "NONE" ? 0 :
    service.paymentRequirement === "DEPOSIT" ? Math.round((total * service.depositPercent) / 100) : total;
  return {
    currency: service.currency, priceCents: price, discountCents: discount, taxCents: tax, totalCents: total, dueNowCents: due,
    taxLabel: settings.taxLabel, taxRatePercent: settings.taxRatePercent,
    coupon: coupon && !couponError ? { id: coupon.id, code: coupon.code } : null, couponError,
    paymentRequirement: service.paymentRequirement, depositPercent: service.depositPercent,
  };
}

export async function quoteFor(service: MeetingService, settings: Setting, couponCode: string | undefined | null, db: Db = prisma): Promise<Quote> {
  let coupon: Coupon | null = null, err: string | null = null;
  const code = couponCode?.trim().toUpperCase();
  if (code) {
    coupon = await db.coupon.findUnique({ where: { code } });
    err = couponProblem(coupon, service.id);
  }
  return calculateQuote(service, settings, coupon, err);
}
