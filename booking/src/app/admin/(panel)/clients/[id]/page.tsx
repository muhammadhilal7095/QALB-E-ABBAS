import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatInTz, formatMoney } from "@/lib/util";
import { PageTitle } from "@/components/AdminBits";
import { StatusBadge } from "@/components/SiteChrome";

export const metadata = { title: "Client" };

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c, s] = await Promise.all([prisma.client.findUnique({ where: { id }, include: { bookings: { include: { service: true }, orderBy: { startAt: "desc" } }, user: true } }), getSettings()]);
  if (!c) notFound();
  return (
    <>
      <Link href="/admin/clients" className="text-sm font-semibold text-brand">← All clients</Link>
      <div className="mt-3"><PageTitle title={c.name} sub={`${c.email} · ${c.phone ?? "no phone"}${c.company ? ` · ${c.company}` : ""} · ${c.country ?? ""}`} /></div>
      <p className="-mt-4 mb-6 text-sm">{c.user ? "Registered account" : "Guest client"}{c.website && <> · <a className="text-brand" href={c.website} target="_blank" rel="noopener noreferrer nofollow">{c.website}</a></>} · Time zone {c.timezone ?? "—"}</p>
      <div className="card overflow-x-auto">
        <table className="table-x min-w-[760px]">
          <thead><tr><th>When</th><th>Meeting</th><th>Status</th><th>Payment</th><th>Total</th><th>Ref</th></tr></thead>
          <tbody>
            {c.bookings.map((b) => (
              <tr key={b.id}>
                <td><Link className="font-semibold text-brand" href={`/admin/meetings/${b.id}`}>{formatInTz(b.startAt, s.timezone, { dateStyle: "medium", timeStyle: "short" })}</Link></td>
                <td>{b.service.name}<span className="block text-xs text-muted">{b.title}</span></td>
                <td><StatusBadge status={b.status} /></td><td><StatusBadge status={b.paymentStatus} /></td>
                <td>{formatMoney(b.totalCents, b.currency)}</td><td className="font-mono text-xs">{b.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
