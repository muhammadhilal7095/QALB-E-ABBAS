import Link from "next/link";
import { requireStaffPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LogoutButton } from "@/components/AuthForms";
import AdminNavLinks from "@/components/AdminNavLinks";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s | Admin · Qalb-E-Abbas" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  const attention = await prisma.booking.count({ where: { OR: [{ status: "PENDING_APPROVAL" }, { changeRequest: { not: "NONE" } }, { status: "EXPIRED", paidCents: { gt: 0 }, refundedCents: 0 }] } });
  return (
    <div className="min-h-screen bg-soft lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="bg-navy text-white/80 lg:sticky lg:top-0 lg:h-screen">
        <div className="flex items-center justify-between gap-3 p-4 lg:block">
          <Link href="/admin" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-light.svg" alt="Qalb-E-Abbas" className="h-8 w-auto" />
          </Link>
          <p className="text-xs lg:mt-3">{user.name} · {user.role === "ADMIN" ? "Admin" : "Staff"}</p>
        </div>
        <AdminNavLinks isAdmin={user.role === "ADMIN"} attention={attention} />
        <div className="hidden p-4 lg:block"><LogoutButton to="/admin/login" /></div>
      </aside>
      <main id="main" className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
