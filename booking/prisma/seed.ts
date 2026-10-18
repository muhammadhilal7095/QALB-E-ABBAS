// Development seed. Prices are EXAMPLES — set real prices in Admin → Services.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SERVICES: [slug: string, name: string, desc: string, dur: number, price: number][] = [
  ["website-development", "Website Development Consultation", "Discuss your website project — business site, e-commerce store, WordPress, Shopify or a custom platform — and get a clear plan and quote.", 30, 30],
  ["app-development", "App Development Consultation", "Talk through your Android, iOS or web app idea, features, technology options and next steps.", 30, 30],
  ["ai-automation", "AI Automation Consultation", "Explore Facebook, Instagram, TikTok and WhatsApp automation and how bots and workflows can save your team time.", 30, 30],
  ["digital-marketing", "Digital Marketing Consultation", "Review your goals and get a practical plan for Meta, TikTok, Google and YouTube advertising.", 45, 45],
  ["seo", "SEO Consultation", "Get an expert view of your website's search visibility and a prioritised SEO roadmap.", 45, 45],
  ["ecommerce", "E-commerce Consultation", "Amazon, eBay, TikTok Shop, Walmart, Etsy or Shopify — plan your e-commerce business in the right order.", 60, 30],
  ["business-registration", "Business Registration Consultation", "UK LTD, US LLC, Malta or UAE company formation — structure, documents and compliance.", 30, 30],
  ["tax", "Tax Consultation", "US and UK corporate tax, IRS Form 5472, HMRC and VAT questions for your business.", 30, 30],
  ["general-business", "General Business Consultation", "A strategic conversation about your business, challenges and growth plans.", 60, 60],
  ["custom", "Custom Meeting", "Something else in mind? Tell us what you'd like to discuss and we'll prepare accordingly.", 30, 30],
];

async function main() {
  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      bankEnabled: true,
      bankInstructions: "Bank: [YOUR BANK NAME]\nAccount name: Qalb-E-Abbas\nSort code: [00-00-00]\nAccount number: [00000000]\nIBAN: [GB00 XXXX 0000 0000 0000 00]\n(Replace with your real bank details in Admin → Settings.)",
      cancellationPolicy: "You can request to cancel or reschedule from your booking page. Requests made at least the notice period shown for your meeting type (usually 24 hours) before the start time are accepted. Later requests are reviewed case by case.",
      refundPolicy: "Cancellations made within the notice period receive a full refund to the original payment method. Late cancellations and no-shows are not normally refunded. Refunds usually appear within 5–10 business days.",
    },
  });

  for (const [i, [slug, name, description, durationMin, price]] of SERVICES.entries()) {
    await prisma.meetingService.upsert({
      where: { slug },
      update: {},
      create: { slug, name, description, durationMin, priceCents: price * 100, currency: slug === "ecommerce" ? "USD" : "GBP", sortOrder: i, isCustom: slug === "custom" },
    });
  }

  // Mon–Fri 09:00–17:30, Sat 10:00–14:00 (business time zone), lunch break weekdays 13:00–14:00.
  if ((await prisma.workingHours.count()) === 0) {
    for (const wd of [1, 2, 3, 4, 5]) await prisma.workingHours.create({ data: { weekday: wd, startMinute: 9 * 60, endMinute: 17 * 60 + 30 } });
    await prisma.workingHours.create({ data: { weekday: 6, startMinute: 10 * 60, endMinute: 14 * 60 } });
    for (const wd of [1, 2, 3, 4, 5]) await prisma.breakTime.create({ data: { weekday: wd, startMinute: 13 * 60, endMinute: 14 * 60, label: "Lunch" } });
  }

  await prisma.coupon.upsert({ where: { code: "WELCOME10" }, update: {}, create: { code: "WELCOME10", percentOff: 10, active: true } });

  // Local development accounts (see README). Do not use these in production.
  const accounts: [string, string, "ADMIN" | "STAFF" | "CLIENT", string][] = [
    ["admin@qalbeabbas.local", "Admin Dev", "ADMIN", "AdminDev2026!"],
    ["staff@qalbeabbas.local", "Staff Dev", "STAFF", "StaffDev2026!"],
    ["client@qalbeabbas.local", "Client Dev", "CLIENT", "ClientDev2026!"],
  ];
  for (const [email, name, role, pw] of accounts) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role, passwordHash: await bcrypt.hash(pw, 12), emailVerifiedAt: new Date() },
    });
    if (role === "CLIENT") {
      await prisma.client.upsert({ where: { email }, update: { userId: user.id }, create: { email, name, userId: user.id, country: "United Kingdom", phone: "+447000000000" } });
    }
  }
  console.log("Seed complete.");
}

main().finally(() => prisma.$disconnect());
