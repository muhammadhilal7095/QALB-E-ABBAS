import { z } from "zod";
import { availableGateways, startPayment, submissionSchema } from "@/lib/checkout";
import { handle, ok, parseJson, rateLimit } from "@/lib/http";
import { preflight, withCors } from "@/lib/cors";

const schema = z.object({
  submission: submissionSchema,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Please accept the terms to continue" }) }),
});

export const OPTIONS = (req: Request) => preflight(req);

/** POST /api/checkout — booking form or cart → secure payment page. */
export const POST = async (req: Request) => withCors(req, await handle(async () => {
  rateLimit(req, "checkout", 15, 600);
  const body = await parseJson(req, schema);
  const gateway = availableGateways()[0];
  return ok(await startPayment(body.submission, gateway ?? "STRIPE"));
})());
