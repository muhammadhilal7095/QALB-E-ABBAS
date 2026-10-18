import { runScheduledJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

/** Scheduled jobs (hold expiry + reminders). Call every minute with ?secret=CRON_SECRET or Authorization: Bearer. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await runScheduledJobs());
}
