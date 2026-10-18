import { prisma } from "./db";
import { getSettings } from "./settings";
import { expireStaleHolds } from "./booking";
import { notifyBooking } from "./email";

/** Runs periodic jobs: releases expired holds and sends meeting reminders. */
export async function runScheduledJobs(now = new Date()) {
  const expired = await expireStaleHolds(prisma, now);
  const settings = await getSettings();
  let reminders = 0;
  for (const hours of settings.reminderHours) {
    const windowEnd = new Date(now.getTime() + hours * 3600_000);
    const due = await prisma.booking.findMany({
      where: { status: "CONFIRMED", startAt: { gt: now, lte: windowEnd }, NOT: { remindersSent: { has: hours } } },
      select: { id: true, remindersSent: true, startAt: true },
    });
    for (const b of due) {
      // Skip the longer reminder if the booking was made inside that window.
      const smaller = settings.reminderHours.filter((h) => h < hours);
      if (smaller.some((h) => b.startAt.getTime() - now.getTime() <= h * 3600_000)) {
        await prisma.booking.update({ where: { id: b.id }, data: { remindersSent: { push: hours } } });
        continue;
      }
      await prisma.booking.update({ where: { id: b.id }, data: { remindersSent: { push: hours } } });
      await notifyBooking(b.id, "reminder");
      reminders++;
    }
  }
  return { expired: expired.length, reminders };
}
