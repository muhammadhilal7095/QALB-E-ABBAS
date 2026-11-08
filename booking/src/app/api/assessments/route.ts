import { z } from "zod";
import { env } from "@/lib/env";
import { button, detailsTable, layout, sendEmail } from "@/lib/email";
import { handle, ok, parseJson, rateLimit } from "@/lib/http";
import { preflight, withCors } from "@/lib/cors";
import { escapeHtml, makeReference } from "@/lib/util";

const text = (max: number) => z.string().trim().max(max);
const schema = z.object({
  assessment: text(80).optional().nullable(),
  topic: z.string().trim().regex(/^[a-z0-9-]{0,60}$/).optional().nullable(),
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
  answers: z.record(z.string().max(10), z.object({ question: text(400), answer: text(600) })).refine((r) => Object.keys(r).length <= 120, "Too many answers"),
});

export const OPTIONS = (req: Request) => preflight(req);

/** POST /api/assessments — emails a Seller Readiness Assessment result to the team and the person. */
export const POST = async (req: Request) => withCors(req, await handle(async () => {
  rateLimit(req, "assessment", 10, 600);
  const a = await parseJson(req, schema);
  const ref = makeReference("SRA");
  const name = a.assessment || "Seller Readiness Assessment";
  const summary = detailsTable([
    ["Reference", escapeHtml(ref)], ["Readiness", `${escapeHtml(a.level)} (${Math.round(a.score)}%)`], ["Path", escapeHtml(a.path)],
    ...a.scores.map((x) => [escapeHtml(x.area), `${Math.round(x.score)}%`] as [string, string]),
  ]);
  const blockers = a.blockers.length
    ? `<p style="margin:18px 0 6px;font-weight:bold;color:#0B1B36">Top priorities to fix first</p><ul style="margin:0;padding-left:18px">${a.blockers.map((b) => `<li style="margin:4px 0">${escapeHtml(b)}</li>`).join("")}</ul>` : "";
  const next = `<p style="margin:18px 0 6px;font-weight:bold;color:#0B1B36">Safest next step: ${escapeHtml(a.nextStep.title)}</p><p style="margin:0">${escapeHtml(a.nextStep.text)}</p>`;
  const answers = detailsTable(Object.entries(a.answers).sort(([x], [y]) => x.localeCompare(y)).map(([k, v]) => [`${k} · ${v.question}`, escapeHtml(v.answer)]));

  const person = detailsTable([
    ["Name", escapeHtml(`${a.firstName} ${a.lastName}`)], ["Email", escapeHtml(a.email)], ["Phone", escapeHtml(a.phone || "—")],
    ["Country", escapeHtml(a.country || "—")], ["Age group", escapeHtml(a.ageGroup || "—")], ["Gender", escapeHtml(a.gender || "—")],
    ["Educational updates", a.marketingOptIn ? "Yes" : "No"],
  ]);
  await sendEmail({
    to: env.adminEmail(), key: `${ref}-admin`, replyTo: a.email,
    subject: `New ${name}: ${a.firstName} ${a.lastName} — ${a.level} (${Math.round(a.score)}%)`,
    html: layout(`New ${name}`, `${person}${summary}${blockers}${next}<p style="margin:18px 0 6px;font-weight:bold;color:#0B1B36">All answers</p>${answers}`),
  });
  await sendEmail({
    to: a.email, key: `${ref}-client`, replyTo: env.adminEmail(),
    subject: `Your ${name} result — ${a.level}`,
    html: layout(`Your ${name} result`, `<p>Hi ${escapeHtml(a.firstName)},</p><p>Thank you for completing the ${escapeHtml(name)}. Here is a copy of your result.</p>${summary}${blockers}${next}
${button("Book a consultation", `${env.mainSiteUrl()}/book-consultation?topic=${a.topic || "general"}`)}<p style="font-size:12px;color:#5F6E85">This assessment is general guidance based on your answers. It is not financial, legal or tax advice and does not predict profit.</p>`),
  });
  return ok({ reference: ref });
})());
