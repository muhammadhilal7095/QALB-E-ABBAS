import { describe, it, expect, beforeEach, afterAll } from "vitest";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { createHold, expireStaleHolds, BookingError, type HoldInput } from "@/lib/booking";
import { fulfillPayment, failPayment, cancelPayment, refundPayment, startCheckout } from "@/lib/payments";
import { handleStripeWebhook, WebhookSignatureError } from "@/lib/webhooks";
import { getSlots } from "@/lib/availability";
import { zonedToUtc, addDays, dateInTz } from "@/lib/tz";

let serviceId = "";
const DATE = addDays(dateInTz(new Date(), "Europe/London"), 10);
const at = (hhmm: string) => zonedToUtc(DATE, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)), "Europe/London");

function input(over: Partial<HoldInput> = {}): HoldInput {
  return {
    serviceId, startAt: at("10:00"), clientTimezone: "Asia/Karachi",
    title: "Website project", purpose: "Discuss a new e-commerce website", description: "We need a Shopify store with 50 products and payment integration.",
    clientName: "Test Client", clientEmail: `client${Math.random().toString(36).slice(2, 8)}@example.com`, clientPhone: "+447000000000",
    country: "Pakistan", commMethod: "Email", platformPref: "Zoom", ...over,
  };
}

beforeEach(async () => {
  for (const t of ["Refund", "Payment", "BookingEvent", "InternalNote", "MeetingLink", "Attachment", "Notification", "Booking", "Client", "Coupon", "MeetingService", "WorkingHours", "BreakTime", "DateOverride", "BlockedSlot", "WebhookEvent", "Setting"]) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${t}"`);
  }
  await prisma.setting.create({ data: { id: 1, timezone: "Europe/London", minNoticeHours: 0, bufferMin: 15, holdMinutes: 30, maxPerDay: 20, slotStepMin: 30 } });
  for (let wd = 0; wd < 7; wd++) await prisma.workingHours.create({ data: { weekday: wd, startMinute: 9 * 60, endMinute: 17 * 60 } });
  const s = await prisma.meetingService.create({ data: { slug: "web", name: "Website Development Consultation", description: "Test service description", durationMin: 30, priceCents: 3000, currency: "GBP" } });
  serviceId = s.id;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("booking conflicts", () => {
  it("allows only one of many simultaneous booking attempts for the same slot", async () => {
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => createHold(input())));
    const ok = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(7);
    for (const r of rejected) expect((r.reason as BookingError).code).toBe("SLOT_TAKEN");
    expect(await prisma.booking.count({ where: { status: "HELD" } })).toBe(1);
  });

  it("enforces the buffer between meetings", async () => {
    await createHold(input({ startAt: at("10:00") }));
    await expect(createHold(input({ startAt: at("10:30") }))).rejects.toMatchObject({ code: "SLOT_TAKEN" }); // inside 15-min buffer
    await expect(createHold(input({ startAt: at("11:00") }))).resolves.toBeTruthy();
  });

  it("the database constraint blocks overlapping active bookings even if app checks are bypassed", async () => {
    const b = await createHold(input());
    await expect(prisma.booking.create({ data: { ...(({ id, reference, manageToken, createdAt, updatedAt, ...rest }) => rest)(b), reference: "X-1", manageToken: "x1", remindersSent: [] } }))
      .rejects.toThrow(/booking_no_overlap|23P01|exclusion/i);
  });

  it("recalculates the price on the server and rejects invalid slots", async () => {
    const b = await createHold(input());
    expect(b.totalCents).toBe(3000);
    expect(b.dueNowCents).toBe(3000);
    await expect(createHold(input({ startAt: at("08:00") }))).rejects.toMatchObject({ code: "SLOT_TAKEN" }); // outside hours
  });

  it("releases abandoned checkouts after the hold expires", async () => {
    const b = await createHold(input());
    const later = new Date(Date.now() + 31 * 60_000);
    const freed = await expireStaleHolds(prisma, later);
    expect(freed).toContain(b.id);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("EXPIRED");
    const slots = await getSlots(30, at("10:00"), at("10:01"));
    expect(slots).toHaveLength(1);
  });
});

describe("payments", () => {
  it("confirms only after verified payment and is idempotent", async () => {
    const b = await createHold(input());
    const { payment } = await startCheckout(b, "MOCK");
    await fulfillPayment(payment.id, { amountCents: 3000 });
    const again = await fulfillPayment(payment.id, { amountCents: 3000 }); // duplicate webhook
    expect(again.already).toBe(true);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("CONFIRMED");
    expect(after.paymentStatus).toBe("PAID");
    expect(after.paidCents).toBe(3000);
  });

  it("reuses the open checkout instead of creating duplicate payments", async () => {
    const b = await createHold(input());
    const first = await startCheckout(b, "MOCK");
    const second = await startCheckout(b, "MOCK");
    expect(second.payment.id).toBe(first.payment.id);
    expect(await prisma.payment.count({ where: { bookingId: b.id } })).toBe(1);
  });

  it("rejects payment amount mismatches", async () => {
    const b = await createHold(input());
    const { payment } = await startCheckout(b, "MOCK");
    await expect(fulfillPayment(payment.id, { amountCents: 1 })).rejects.toThrow(/mismatch/);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("HELD");
  });

  it("failed payment keeps the hold so the client can retry", async () => {
    const b = await createHold(input());
    const { payment } = await startCheckout(b, "MOCK");
    await failPayment(payment.id, "Card declined");
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("HELD");
    expect(after.paymentStatus).toBe("FAILED");
    const retry = await startCheckout(after, "MOCK");
    expect(retry.payment.id).not.toBe(payment.id);
  });

  it("cancelled/expired checkout releases the slot", async () => {
    const b = await createHold(input());
    const { payment } = await startCheckout(b, "MOCK");
    await cancelPayment(payment.id, "Expired", true);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("EXPIRED");
  });

  it("payment arriving after the slot was re-booked is flagged instead of double-booking", async () => {
    const a = await createHold(input());
    const { payment } = await startCheckout(a, "MOCK");
    await expireStaleHolds(prisma, new Date(Date.now() + 31 * 60_000));
    await createHold(input()); // someone else takes the freed slot
    const res = await fulfillPayment(payment.id, { amountCents: 3000 });
    expect(res.conflict).toBe(true);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.status).toBe("EXPIRED");
    expect(after.paymentStatus).toBe("PAID");
  });

  it("supports partial then full refunds", async () => {
    const b = await createHold(input());
    const { payment } = await startCheckout(b, "MOCK");
    await fulfillPayment(payment.id);
    await refundPayment(payment.id, 1000, "Partial", null);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).paymentStatus).toBe("PARTIALLY_REFUNDED");
    await expect(refundPayment(payment.id, 5000, "Too much", null)).rejects.toThrow();
    await refundPayment(payment.id, 2000, "Rest", null);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.paymentStatus).toBe("REFUNDED");
    expect(after.refundedCents).toBe(3000);
  });

  it("deposits mark the booking partially paid", async () => {
    await prisma.meetingService.update({ where: { id: serviceId }, data: { paymentRequirement: "DEPOSIT", depositPercent: 50 } });
    const b = await createHold(input());
    expect(b.dueNowCents).toBe(1500);
    const { payment } = await startCheckout(b, "MOCK");
    await fulfillPayment(payment.id);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("CONFIRMED");
    expect(after.paymentStatus).toBe("PARTIALLY_PAID");
  });

  it("manual approval mode holds paid bookings for admin review", async () => {
    await prisma.setting.update({ where: { id: 1 }, data: { manualApproval: true } });
    const b = await createHold(input());
    const { payment } = await startCheckout(b, "MOCK");
    await fulfillPayment(payment.id);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("PENDING_APPROVAL");
  });
});

describe("stripe webhooks", () => {
  const secret = "whsec_test_secret_for_unit_tests";
  const sign = (payload: string) => Stripe.webhooks.generateTestHeaderString({ payload, secret });

  it("rejects invalid signatures", async () => {
    const payload = JSON.stringify({ id: "evt_bad", type: "checkout.session.completed", data: { object: {} } });
    await expect(handleStripeWebhook(payload, "t=1,v1=deadbeef", secret)).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it("confirms the booking from a signed checkout.session.completed event, once", async () => {
    const b = await createHold(input());
    const { payment } = await startCheckout(b, "MOCK");
    const payload = JSON.stringify({
      id: "evt_test_1", object: "event", type: "checkout.session.completed",
      data: { object: { object: "checkout.session", payment_status: "paid", amount_total: 3000, payment_intent: "pi_test_1", metadata: { paymentId: payment.id } } },
    });
    const first = await handleStripeWebhook(payload, sign(payload), secret);
    const second = await handleStripeWebhook(payload, sign(payload), secret);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("CONFIRMED");
    expect(after.paidCents).toBe(3000);
  });

  it("releases the hold on checkout.session.expired", async () => {
    const b = await createHold(input());
    const { payment } = await startCheckout(b, "MOCK");
    const payload = JSON.stringify({ id: "evt_test_2", object: "event", type: "checkout.session.expired", data: { object: { object: "checkout.session", metadata: { paymentId: payment.id } } } });
    await handleStripeWebhook(payload, sign(payload), secret);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("EXPIRED");
  });
});
