"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNavLinks({ isAdmin, attention }: { isAdmin: boolean; attention: number }) {
  const path = usePathname();
  const items: [string, string, boolean][] = [
    ["/admin", "Dashboard", true], ["/admin/meetings", "Meetings", true], ["/admin/orders", "Service orders", true], ["/admin/assessments", "Assessments", true], ["/admin/clients", "Clients", true], ["/admin/payments", "Payments & Refunds", true],
    ["/admin/services", "Services & Pricing", isAdmin], ["/admin/availability", "Availability", true], ["/admin/reports", "Reports", true],
    ["/admin/emails", "Email log", true], ["/admin/settings", "Settings", isAdmin], ["/admin/audit", "Audit log", isAdmin],
  ];
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
      {items.filter((i) => i[2]).map(([href, label]) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}>
            {label}
            {href === "/admin/meetings" && attention > 0 && <span className="rounded-full bg-gold px-2 text-xs font-bold text-navy">{attention}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
