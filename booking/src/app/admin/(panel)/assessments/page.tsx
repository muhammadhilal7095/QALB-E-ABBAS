import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatInTz } from "@/lib/util";
import { PageTitle } from "@/components/AdminBits";

export const metadata = { title: "Assessments" };

export default async function Assessments({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const s = await getSettings();
  const where: Prisma.AssessmentWhereInput = {};
  if (sp.q) where.OR = [{ reference: { contains: sp.q, mode: "insensitive" } }, { firstName: { contains: sp.q, mode: "insensitive" } }, { lastName: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q, mode: "insensitive" } }];
  if (sp.level) where.level = sp.level;
  const rows = await prisma.assessment.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <>
      <PageTitle title="Seller Readiness Assessments" sub="Submitted from the website's free assessment." />
      <form className="card mb-5 grid gap-3 p-4 sm:grid-cols-4" method="get">
        <input className="input sm:col-span-2" name="q" defaultValue={sp.q} placeholder="Name, email or reference…" aria-label="Search assessments" />
        <select className="input" name="level" defaultValue={sp.level ?? ""} aria-label="Readiness level"><option value="">All levels</option>{["Not ready yet", "Building foundations", "Nearly ready", "Ready to proceed"].map((x) => <option key={x}>{x}</option>)}</select>
        <button className="btn-primary btn-sm">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-x min-w-[900px]">
          <thead><tr><th>Date</th><th>Reference</th><th>Name</th><th>Country</th><th>Path</th><th>Readiness</th><th>Opt-in</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-xs">{formatInTz(a.createdAt, s.timezone, { dateStyle: "medium", timeStyle: "short" })}</td>
                <td><Link className="font-mono text-xs font-semibold text-brand" href={`/admin/assessments/${a.id}`}>{a.reference}</Link></td>
                <td>{a.firstName} {a.lastName}<span className="block text-xs text-muted">{a.email}</span></td>
                <td className="text-xs">{a.country ?? "—"}</td>
                <td className="text-xs">{a.path}</td>
                <td><span className="font-semibold">{a.level}</span><span className="block text-xs text-muted">{a.score}%</span></td>
                <td className="text-xs">{a.marketingOptIn ? "Yes" : "No"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="py-6 text-center text-muted">No assessments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
