import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatInTz, formatMoney } from "@/lib/util";
import { getSettings } from "@/lib/settings";
import { PageTitle } from "@/components/AdminBits";

export const metadata = { title: "Clients" };

export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const s = await getSettings();
  const clients = await prisma.client.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { company: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : undefined,
    include: { bookings: { select: { paidCents: true, refundedCents: true, startAt: true, status: true } }, user: { select: { id: true } } },
    orderBy: { createdAt: "desc" }, take: 200,
  });
  return (
    <>
      <PageTitle title="Clients" sub={`${clients.length} shown`} />
      <form className="card mb-5 flex gap-3 p-4" method="get"><input className="input" name="q" defaultValue={q} placeholder="Search name, email, company or phone" aria-label="Search clients" /><button className="btn-primary btn-sm">Search</button></form>
      <div className="card overflow-x-auto">
        <table className="table-x min-w-[860px]">
          <thead><tr><th>Client</th><th>Company</th><th>Country</th><th>Bookings</th><th>Paid (net)</th><th>Last meeting</th><th>Account</th><th>Since</th></tr></thead>
          <tbody>
            {clients.map((c) => {
              const live = c.bookings.filter((b) => b.status !== "EXPIRED");
              const last = live.map((b) => b.startAt).sort((a, b) => +b - +a)[0];
              return (
                <tr key={c.id}>
                  <td><Link className="font-semibold text-brand" href={`/admin/clients/${c.id}`}>{c.name}</Link><span className="block text-xs text-muted">{c.email} · {c.phone ?? ""}</span></td>
                  <td>{c.company ?? "—"}</td><td>{c.country ?? "—"}</td><td>{live.length}</td>
                  <td>{formatMoney(c.bookings.reduce((n, b) => n + b.paidCents - b.refundedCents, 0), s.currency)}</td>
                  <td className="text-xs">{last ? formatInTz(last, s.timezone, { dateStyle: "medium", timeStyle: undefined }) : "—"}</td>
                  <td className="text-xs">{c.user ? "Registered" : "Guest"}</td>
                  <td className="text-xs">{formatInTz(c.createdAt, s.timezone, { dateStyle: "medium", timeStyle: undefined })}</td>
                </tr>
              );
            })}
            {!clients.length && <tr><td colSpan={8} className="py-6 text-center text-muted">No clients found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
