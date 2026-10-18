import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

export default function setup() {
  const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m![1], m![2]]));
  // Apply migrations to the dedicated test database (never the dev database).
  execSync("npx prisma migrate deploy", { stdio: "ignore", env: { ...process.env, DATABASE_URL: env.TEST_DATABASE_URL } });
}
