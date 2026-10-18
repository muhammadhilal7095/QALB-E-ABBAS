import Link from "next/link";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { env } from "@/lib/settings";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const main = env.mainSiteUrl();
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-4">
        <a href={`${main}/index.html`} className="flex shrink-0 items-center" aria-label="Qalb-E-Abbas — main website">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Qalb-E-Abbas" width={170} height={40} className="h-9 w-auto" />
        </a>
        <nav className="ml-auto hidden items-center gap-1 text-sm font-medium text-ink md:flex" aria-label="Main">
          <a href={`${main}/index.html`} className="rounded-lg px-3 py-2 hover:text-brand">Home</a>
          <a href={`${main}/services.html`} className="rounded-lg px-3 py-2 hover:text-brand">Services</a>
          <Link href="/" className="rounded-lg px-3 py-2 hover:text-brand">Meeting Types</Link>
          {user ? (
            <Link href={isStaff(user) ? "/admin" : "/account"} className="rounded-lg px-3 py-2 hover:text-brand">{isStaff(user) ? "Admin" : "My Meetings"}</Link>
          ) : (
            <Link href="/account/login" className="rounded-lg px-3 py-2 hover:text-brand">Sign in</Link>
          )}
        </nav>
        <Link href="/#services" className="btn-gold ml-auto md:ml-2">Book a Meeting</Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const main = env.mainSiteUrl();
  return (
    <footer className="no-print mt-16 bg-navy text-sm text-white/75">
      <div className="container-x grid gap-8 py-10 md:grid-cols-3">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-light.svg" alt="Qalb-E-Abbas" width={170} height={40} className="mb-3 h-9 w-auto" />
          <p className="max-w-xs leading-relaxed">Empowering entrepreneurs through e-commerce education, mentorship, business consultancy, and digital growth solutions.</p>
        </div>
        <div>
          <h2 className="mb-3 font-display text-base font-bold text-white">Contact</h2>
          <ul className="space-y-1.5">
            <li>Oldham, Manchester, United Kingdom</li>
            <li><a className="hover:text-white" href="tel:+447862605011">+44 7862 605011</a></li>
            <li><a className="hover:text-white" href="mailto:contact@qalbeabbas.com">contact@qalbeabbas.com</a></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-display text-base font-bold text-white">Policies</h2>
          <ul className="space-y-1.5">
            <li><Link className="hover:text-white" href="/cancellation-policy">Cancellation &amp; Refund Policy</Link></li>
            <li><Link className="hover:text-white" href="/terms">Terms and Conditions</Link></li>
            <li><Link className="hover:text-white" href="/privacy">Privacy Policy</Link></li>
            <li><a className="hover:text-white" href={`${main}/index.html`}>Back to main website</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs">© {new Date().getFullYear()} Qalb-E-Abbas. All rights reserved.</div>
    </footer>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    CONFIRMED: "bg-green-100 text-green-800", COMPLETED: "bg-slate-200 text-slate-800", HELD: "bg-amber-100 text-amber-800",
    PENDING_PAYMENT: "bg-amber-100 text-amber-800", PENDING_APPROVAL: "bg-blue-100 text-blue-800", CANCELLED: "bg-red-100 text-red-800",
    REJECTED: "bg-red-100 text-red-800", EXPIRED: "bg-slate-100 text-slate-600",
    PAID: "bg-green-100 text-green-800", PARTIALLY_PAID: "bg-blue-100 text-blue-800", UNPAID: "bg-slate-100 text-slate-600",
    PENDING: "bg-amber-100 text-amber-800", FAILED: "bg-red-100 text-red-800", REFUNDED: "bg-purple-100 text-purple-800",
    PARTIALLY_REFUNDED: "bg-purple-100 text-purple-800", SUCCEEDED: "bg-green-100 text-green-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
  };
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? "bg-slate-100 text-slate-700"}`}>{status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span>;
}
