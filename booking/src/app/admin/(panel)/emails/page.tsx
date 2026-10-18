import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings, env } from "@/lib/settings";
import { formatInTz } from "@/lib/util";
import { PageTitle } from "@/components/AdminBits";

export const metadata = { title: "Email log" };

export default async function Emails({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page: p } = await searchParams;
  const page = Math.max(1, Number(p) || 1);
  const s = await getSettings();
  const where = q ? { OR: [{ to: { contains: q, mode: "insensitive" as const } }, { subject: { contains: q, mode: "insensitive" as const } }, { template: { contains: q } }] } : {};
  const [rows, count] = await Promise.all([
    prisma.notification.findMany({ where, include: { booking: { select: { id: true, reference: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 }),
    prisma.notification.count({ where }),
  ]);
  return (
    <>
      <PageTitle title="Email log" sub={`${count} message(s)`} />
      {!env.emailConfigured() && <p className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><b>Email sending is not configured.</b> Messages are recorded here with status LOGGED but not delivered. Add RESEND_API_KEY and EMAIL_FROM to send real emails.</p>}
      <form className="card mb-5 flex gap-3 p-4" method="get"><input className="input" name="q" defaultValue={q} placeholder="Search recipient, subject or template" aria-label="Search emails" /><button className="btn-primary btn-sm">Search</button></form>
      <ul className="space-y-3">
        {rows.map((n) => (
          <li key={n.id} className="card p-4">
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                <span><b className="text-ink">{n.subject}</b><span className="block text-xs text-muted">To {n.to} · {n.template}{n.booking && <> · <Link className="text-brand" href={`/admin/meetings/${n.booking.id}`}>{n.booking.reference}</Link></>}</span></span>
                <span className="flex items-center gap-2 text-xs"><span className={`rounded-full px-2 py-0.5 font-semibold ${n.status === "SENT" ? "bg-green-100 text-green-800" : n.status === "FAILED" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>{n.status}</span>{formatInTz(n.createdAt, s.timezone, { dateStyle: "medium", timeStyle: "short" })}</span>
              </summary>
              {n.error && <p className="mt-2 text-xs text-red-700">{n.error}</p>}
              <iframe title={n.subject} sandbox="" srcDoc={n.body} className="mt-3 h-96 w-full rounded-xl border border-line bg-white" />
            </details>
          </li>
        ))}
        {!rows.length && <li className="card p-8 text-center text-muted">No emails yet.</li>}
      </ul>
      {count > 50 && <div className="mt-4 flex justify-between text-sm"><span>Page {page} of {Math.ceil(count / 50)}</span><span className="flex gap-2">{page > 1 && <Link className="btn-ghost btn-sm" href={`?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>Previous</Link>}{page * 50 < count && <Link className="btn-ghost btn-sm" href={`?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>Next</Link>}</span></div>}
    </>
  );
}
