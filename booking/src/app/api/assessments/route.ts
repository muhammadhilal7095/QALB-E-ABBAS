import { z } from "zod";
import { saveAssessment } from "@/lib/assessments";
import { handle, ok, parseJson, rateLimit } from "@/lib/http";
import { clientIp } from "@/lib/auth";
import { preflight, withCors } from "@/lib/cors";

const text = (max: number) => z.string().trim().max(max);
const schema = z.object({
  firstName: text(80).min(1, "Please enter your first name"),
  lastName: text(80).min(1, "Please enter your last name"),
  email: text(200).email("Please enter a valid email address"),
  phone: text(40).optional().nullable(),
  ageGroup: text(40).optional().nullable(),
  gender: text(40).optional().nullable(),
  marketingOptIn: z.boolean(),
  truthful: z.literal(true, { errorMap: () => ({ message: "Please confirm your answers are truthful" }) }),
  country: text(80).optional().nullable(),
  path: text(80),
  level: text(80),
  score: z.number().min(0).max(100),
  scores: z.array(z.object({ area: text(80), score: z.number().min(0).max(100) })).max(10),
  blockers: z.array(text(300)).max(10),
  nextStep: z.object({ title: text(200), text: text(1000) }),
  answers: z.record(z.string().max(10), z.object({ question: text(400), answer: text(400) })).refine((r) => Object.keys(r).length <= 40, "Too many answers"),
});

export const OPTIONS = (req: Request) => preflight(req);

/** POST /api/assessments — saves a Seller Readiness Assessment from the website. */
export const POST = async (req: Request) => withCors(req, await handle(async () => {
  await rateLimit(`assessment:${await clientIp()}`, 10, 600);
  const body = await parseJson(req, schema);
  const a = await saveAssessment(body);
  return ok({ reference: a.reference });
})());
