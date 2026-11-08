import { z } from "zod";
import { env } from "@/lib/env";
import { priceSubmission, readPayload, sendPaidEmails, signPayload, type Submission } from "@/lib/checkout";
import { fail, handle, ok, parseJson } from "@/lib/http";

const schema = z.object({ p: z.string().max(20000), outcome: z.enum(["succeed", "cancel"]) });

/** DEVELOPMENT ONLY — simulates a successful or cancelled payment (no real money). */
export const POST = handle(async (req: Request) => {
  if (!env.testPaymentsEnabled()) return fail("Not available.", 404);
  const body = await parseJson(req, schema);
  const { ref, sub } = readPayload<{ ref: string; sub: Submission }>(body.p);
  const site = env.mainSiteUrl();
  if (body.outcome === "cancel") {
    return ok({ redirectUrl: sub.kind === "booking" ? `${site}/book-consultation?cancelled=1` : `${site}/cart?cancelled=1` });
  }
  const priced = priceSubmission(sub, { checkDate: false });
  await sendPaidEmails({ ref, sub, priced, paidCents: priced.totalCents, paymentId: `test_${ref}` });
  return ok({ redirectUrl: `${env.appUrl()}/thank-you?p=${signPayload({ ref, sub, paid: true })}` });
});
