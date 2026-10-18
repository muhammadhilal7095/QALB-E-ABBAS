import type { Assessment } from "@prisma/client";
import { prisma } from "./db";
import { env, getSettings } from "./settings";
import { button, detailsTable, layout, sendEmail } from "./email";
import { escapeHtml, makeReference } from "./util";

export type AssessmentInput = {
  firstName: string; lastName: string; email: string; phone?: string | null; ageGroup?: string | null; gender?: string | null;
  marketingOptIn: boolean; country?: string | null; path: string; level: string; score: number;
  scores: { area: string; score: number }[];
  blockers: string[];
  nextStep: { title: string; text: string };
  answers: Record<string, { question: string; answer: string }>;
};

export async function saveAssessment(input: AssessmentInput): Promise<Assessment> {
  const a = await prisma.assessment.create({
    data: {
      reference: makeReference("SRA"),
      firstName: input.firstName.trim(), lastName: input.lastName.trim(), email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null, ageGroup: input.ageGroup || null, gender: input.gender || null,
      marketingOptIn: input.marketingOptIn, country: input.country || null,
      path: input.path, level: input.level, score: Math.max(0, Math.min(100, Math.round(input.score))),
      scores: input.scores, blockers: input.blockers, answers: input.answers,
    },
  });
  await notifyAssessment(a, input.nextStep);
  return a;
}

async function notifyAssessment(a: Assessment, next: { title: string; text: string }) {
  try {
    const s = await getSettings();
    const scores = (a.scores as { area: string; score: number }[]).map((x) => [escapeHtml(x.area), `${x.score}%`] as [string, string]);
    const blockers = (a.blockers as string[]);
    const blockersHtml = blockers.length
      ? `<p style="margin:18px 0 6px;font-weight:bold;color:#0B1B36">Top priorities to fix first</p><ul style="margin:0;padding-left:18px">${blockers.map((b) => `<li style="margin:4px 0">${escapeHtml(b)}</li>`).join("")}</ul>`
      : "";
    const summary = detailsTable([["Reference", escapeHtml(a.reference)], ["Readiness", `${escapeHtml(a.level)} (${a.score}%)`], ["Path", escapeHtml(a.path)], ...scores]);

    const clientBody = `<p>Hi ${escapeHtml(a.firstName)},</p><p>Thank you for completing the Seller Readiness Assessment. Here is a copy of your result.</p>${summary}${blockersHtml}
<p style="margin:18px 0 6px;font-weight:bold;color:#0B1B36">Your safest next step: ${escapeHtml(next.title)}</p><p style="margin:0">${escapeHtml(next.text)}</p>
${button("Book a consultation", `${env.mainSiteUrl()}/book-consultation.html?topic=amazon`)}
<p style="font-size:12px;color:#5F6E85">This assessment is general guidance based on your answers. It is not financial, legal or tax advice and does not predict profit.</p>`;
    await sendEmail({ to: a.email, subject: `Your Seller Readiness result — ${a.level}`, html: layout(s, "Your Seller Readiness result", clientBody), template: "assessment_result" });

    const adminBody = `${detailsTable([["Name", escapeHtml(`${a.firstName} ${a.lastName}`)], ["Email", escapeHtml(a.email)], ["Phone", escapeHtml(a.phone || "—")], ["Country", escapeHtml(a.country || "—")], ["Marketing opt-in", a.marketingOptIn ? "Yes" : "No"]])}${summary}${blockersHtml}${button("Open in admin", `${env.appUrl()}/admin/assessments/${a.id}`)}`;
    await sendEmail({ to: s.adminNotifyEmail, subject: `New assessment: ${a.firstName} ${a.lastName} — ${a.level} (${a.score}%)`, html: layout(s, "New Seller Readiness assessment", adminBody), template: "admin_assessment" });
  } catch (e) {
    console.error("notifyAssessment failed", e);
  }
}
