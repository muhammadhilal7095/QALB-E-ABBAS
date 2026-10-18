import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function BookHome() {
  const [services, settings] = await Promise.all([
    prisma.meetingService.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    getSettings(),
  ]);
  return (
    <>
      <section className="bg-navy text-white">
        <div className="container-x grid gap-10 py-14 md:grid-cols-[1.3fr_1fr] md:py-20">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-gold">Book a meeting</p>
            <h1 className="font-display text-3xl font-extrabold leading-tight text-white md:text-5xl">Book a Consultation with Our Team</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">
              Choose a meeting type, tell us what you&apos;d like to discuss, pick a time that suits you and pay securely online. You&apos;ll get instant confirmation by email.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#services" className="btn-gold">Choose a meeting type</a>
              <Link href="/account" className="btn border border-white/30 text-white hover:bg-white/10">My meetings</Link>
            </div>
          </div>
          <ol className="grid content-center gap-3 text-sm">
            {["Choose a meeting type", "Describe the purpose", "Pick a date & time", "Enter your details", "Pay securely & get confirmation"].map((s, i) => (
              <li key={s} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold font-display font-extrabold text-navy">{i + 1}</span>
                <span className="font-semibold text-white">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="services" className="container-x scroll-mt-20 py-14">
        <p className="eyebrow">Meeting services</p>
        <h2 className="mt-2 text-2xl font-extrabold md:text-3xl">Choose your meeting type</h2>
        <p className="mt-2 max-w-2xl text-body">All times are shown in your own time zone. Prices include {settings.taxRatePercent > 0 ? `${settings.taxLabel} where applicable` : "everything — no hidden fees"}.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <article key={s.id} className="card flex flex-col p-6">
              <h3 className="text-lg font-extrabold leading-snug">{s.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed">{s.description}</p>
              <div className="mt-5 flex items-center gap-3 border-t border-line pt-4 text-sm">
                <span className="rounded-full bg-soft px-3 py-1 font-semibold text-ink">{s.durationMin} min</span>
                <span className="font-display text-lg font-extrabold text-ink">{s.priceCents === 0 ? "Free" : formatMoney(s.priceCents, s.currency)}</span>
                {s.paymentRequirement === "DEPOSIT" && <span className="text-xs text-muted">{s.depositPercent}% deposit</span>}
              </div>
              <Link href={`/book/${s.slug}`} className="btn-primary mt-4 w-full">Book this meeting</Link>
            </article>
          ))}
        </div>
        {services.length === 0 && <p className="card mt-8 p-6">No meeting types are available right now. Please contact us.</p>}
      </section>

      <section className="bg-soft">
        <div className="container-x grid gap-6 py-12 md:grid-cols-3">
          {[
            ["Secure payment", "Card payments are processed by our payment provider. We never store your card details."],
            ["Your time zone", "Every time is shown in your local time zone, and confirmed by email."],
            ["Flexible", "Need to change plans? Request a reschedule or cancellation from your booking page."],
          ].map(([t, d]) => (
            <div key={t} className="card p-5">
              <h3 className="font-extrabold">{t}</h3>
              <p className="mt-1 text-sm leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
