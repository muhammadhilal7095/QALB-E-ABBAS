// Background worker: releases expired holds and sends meeting reminders.
// Run alongside the web server (`npm run worker`), or call POST /api/cron
// from an external scheduler instead — both use runScheduledJobs().
import { runScheduledJobs } from "../src/lib/jobs";

const INTERVAL_MS = 60_000;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const r = await runScheduledJobs(new Date());
    if (r.expired || r.reminders) console.log(new Date().toISOString(), JSON.stringify(r));
  } catch (e) {
    console.error(new Date().toISOString(), "job run failed:", e);
  } finally {
    running = false;
  }
}

console.log(`Worker started — running jobs every ${INTERVAL_MS / 1000}s`);
void tick();
setInterval(tick, INTERVAL_MS);
