import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatInTz } from "@/lib/util";
import { PageTitle } from "@/components/AdminBits";

export const metadata = { title: "Audit log" };

export default async function Audit({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireStaffPage(true);
  const { q, page: p } = await searchParams;
  const page = Math.max(1, Number(p) || 1);
  const s = await getSettings();
  const where = q ? { OR: [{ action: { contains: q, mode: "insensitive" as const } }, { entity: { contains: q, mode: "insensitive" as const } }, { entityId: q }, { actor: { email: { contains: q, mode: "insensitive" as const } } }] } : {};
  const [rows, count] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 100, take: 100 }),
    prisma.auditLog.count({ where }),
  ]);
  return (
    <>
      <PageTitle title="Audit log" sub="Every administrative action, with who did it and from where." />
      <form className="card mb-5 flex gap-3 p-4" method="get"><input className="input" name="q" defaultValue={q} placeholder="Search action, entity or user email" aria-label="Search audit log" /><button className="btn-primary btn-sm">Search</button></form>
      <div className="card overflow-x-auto">
        <table className="table-x min-w-[900px]">
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th><th>IP</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-xs">{formatInTz(a.createdAt, s.timezone, { dateStyle: "medium", timeStyle: "medium" })}</td>
                <td>{a.actor?.name ?? "System"}<span className="block text-xs text-muted">{a.actor?.email}</span></td>
                <td className="font-semibold text-ink">{a.action}</td>
                <td className="text-xs">{a.entity === "Booking" && a.entityId ? <Link className="text-brand" href={`/admin/meetings/${a.entityId}`}>{a.entity}</Link> : a.entity}<span className="block font-mono text-muted">{a.entityId}</span></td>
                <td className="max-w-sm"><code className="block truncate text-xs" title={JSON.stringify(a.data)}>{a.data ? JSON.stringify(a.data) : "—"}</code></td>
                <td className="font-mono text-xs">{a.ip ?? "—"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="py-6 text-center text-muted">No entries.</td></tr>}
          </tbody>
        </table>
      </div>
      {count > 100 && <div className="mt-4 flex justify-between text-sm"><span>Page {page} of {Math.ceil(count / 100)}</span><span className="flex gap-2">{page > 1 && <Link className="btn-ghost btn-sm" href={`?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>Previous</Link>}{page * 100 < count && <Link className="btn-ghost btn-sm" href={`?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>Next</Link>}</span></div>}
    </>
  );
}
