// Starts a local PostgreSQL server for development (no Docker/Postgres install needed).
// Data lives in ./.pgdata. Production uses a normal hosted PostgreSQL via DATABASE_URL.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dataDir = new URL("../.pgdata", import.meta.url).pathname;
const firstRun = !existsSync(dataDir);
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: "qalb", password: "qalb_dev_password", port: 5433, persistent: true });

if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) {
  await pg.createDatabase("qalb_booking");
  await pg.createDatabase("qalb_booking_test");
}
console.log("Local PostgreSQL running on postgresql://qalb:qalb_dev_password@localhost:5433/qalb_booking  (Ctrl+C to stop)");
const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
