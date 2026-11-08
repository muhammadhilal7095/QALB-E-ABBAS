import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", env: { PAYMENT_MOCK_ENABLED: "true", STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" } },
});
