export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <section className="container-x max-w-3xl py-12">
      <p className="eyebrow">Legal</p>
      <h1 className="font-display text-3xl font-extrabold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
      <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">Draft wording supplied with the booking system — have it reviewed by a qualified adviser before going live.</div>
      <div className="legal mt-8 space-y-4 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </section>
  );
}
