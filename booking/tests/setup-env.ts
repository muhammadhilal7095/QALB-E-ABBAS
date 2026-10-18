// Point every test at the separate test database.
import { readFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";
process.env.PAYMENT_MOCK_ENABLED = "true";
