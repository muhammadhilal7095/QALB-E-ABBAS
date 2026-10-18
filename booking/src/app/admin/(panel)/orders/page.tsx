import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatInTz, formatMoney } from "@/lib/util";
import { PageTitle } from "@/components/AdminBits";
import { StatusBadge } from "@/components/SiteChrome";

export const metadata = { title: "Service orders" };
const STATUSES = ["PENDING_PAYMENT", "PAID", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REFUNDED"];

export default async function Orders({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const s = await getSettings();
  const where: Prisma.OrderWhereInput = {};
  if (sp.status) where.status = sp.status as Prisma.OrderWhereInput["status"];
  if (sp.q) where.OR = [{ reference: { contains: sp.q, mode: "insensitive" } }, { clientName: { contains: sp.q, mode: "insensitive" } }, { clientEmail: { contains: sp.q, mode: "insensitive" } }, { items: { some: { name: { contains: sp.q, mode: "insensitive" } } } }];
  const orders = await prisma.order.findMany({ where, include: { items: true }, orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <>
      <PageTitle title="Service orders" sub="Fixed-price services bought from the website cart." />
      <form className="card mb-5 grid gap-3 p-4 sm:grid-cols-4" method="get">
        <input className="input sm:col-span-2" name="q" defaultValue={sp.q} placeholder="Order reference, client, service…" aria-label="Search orders" />
        <select className="input" name="status" defaultValue={sp.status ?? ""} aria-label="Status"><option value="">All statuses</option>{STATUSES.map((x) => <option key={x} value={x}>{x.replace(/_/g, " ").toLowerCase()}</option>)}</select>
        <button className="btn-primary btn-sm">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-x min-w-[900px]">
          <thead><tr><th>Date</th><th>Order</th><th>Client</th><th>Services</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="whitespace-nowrap text-xs">{formatInTz(o.createdAt, s.timezone, { dateStyle: "medium", timeStyle: "short" })}</td>
                <td><Link className="font-mono text-xs font-semibold text-brand" href={`/admin/orders/${o.id}`}>{o.reference}</Link></td>
                <td>{o.clientName}<span className="block text-xs text-muted">{o.clientEmail}</span></td>
                <td className="text-xs">{o.items.map((i) => `${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`).join(", ")}</td>
                <td className="font-semibold">{formatMoney(o.totalCents, o.currency)}</td>
                <td><StatusBadge status={o.status} /></td>
              </tr>
            ))}
            {!orders.length && <tr><td colSpan={6} className="py-6 text-center text-muted">No orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
