import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatInTz } from "@/lib/util";
import { PageTitle } from "@/components/AdminBits";

export const metadata = { title: "Assessment" };

export default async function AssessmentDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage();
  const { id } = await params;
  const a = await prisma.assessment.findUnique({ where: { id } });
  if (!a) notFound();
  const s = await getSettings();
  const scores = a.scores as { area: string; score: number }[];
  const blockers = a.blockers as string[];
  const answers = Object.entries(a.answers as Record<string, { question: string; answer: string }>).sort(([x], [y]) => x.localeCompare(y));
  return (
    <>
      <PageTitle title={`${a.firstName} ${a.lastName}`} sub={`${a.reference} · ${formatInTz(a.createdAt, s.timezone, { dateStyle: "full", timeStyle: "short" })}`}>
        <Link className="btn-ghost btn-sm" href="/admin/assessments">All assessments</Link>
      </PageTitle>
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="card p-5">
          <h2 className="text-lg font-extrabold">Answers</h2>
          <dl className="mt-3 divide-y divide-line">
            {answers.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-3 sm:grid-cols-[1fr_1fr] sm:gap-4">
                <dt className="text-sm text-muted"><span className="mr-2 font-mono text-xs text-brand">{k}</span>{v.question}</dt>
                <dd className="text-sm font-semibold text-ink">{v.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="space-y-5">
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Readiness</p>
            <p className="mt-1 text-2xl font-extrabold text-ink">{a.level}</p>
            <p className="text-sm text-muted">{a.score}% · {a.path} path</p>
            <ul className="mt-4 space-y-3">
              {scores.map((x) => (
                <li key={x.area} className="text-sm">
                  <div className="flex justify-between"><span>{x.area}</span><span className="font-semibold">{x.score}%</span></div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand" style={{ width: `${x.score}%` }} /></div>
                </li>
              ))}
            </ul>
          </div>
          {blockers.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-2 text-lg font-extrabold">Top blockers</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          )}
          <div className="card p-5 text-sm">
            <h2 className="mb-2 text-lg font-extrabold">Contact</h2>
            <p><a className="text-brand" href={`mailto:${a.email}`}>{a.email}</a></p>
            {a.phone && <p><a className="text-brand" href={`tel:${a.phone}`}>{a.phone}</a></p>}
            <p className="mt-2 text-muted">Country: {a.country ?? "—"} · Age: {a.ageGroup ?? "—"} · Gender: {a.gender ?? "—"}</p>
            <p className="text-muted">Educational updates: {a.marketingOptIn ? "Yes" : "No"}</p>
          </div>
        </div>
      </div>
    </>
  );
}
