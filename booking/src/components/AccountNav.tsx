import Link from "next/link";
import { LogoutButton } from "./AuthForms";

export default function AccountNav({ active, name }: { active: string; name: string }) {
  const items = [["/account", "Dashboard"], ["/account/meetings", "My Meetings"], ["/account/payments", "Payment History"], ["/account/profile", "Profile"]];
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="eyebrow">Client portal</p>
        <h1 className="mt-1 text-2xl font-extrabold">Hello, {name.split(" ")[0]}</h1>
      </div>
      <nav className="flex flex-wrap items-center gap-1 rounded-full border border-line bg-white p-1 text-sm" aria-label="Account">
        {items.map(([href, label]) => (
          <Link key={href} href={href} aria-current={active === href ? "page" : undefined}
            className={`rounded-full px-4 py-2 font-semibold ${active === href ? "bg-navy text-white" : "text-ink hover:bg-soft"}`}>{label}</Link>
        ))}
        <LogoutButton />
      </nav>
    </div>
  );
}
