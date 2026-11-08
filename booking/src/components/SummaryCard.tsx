import type { Paid } from "@/lib/checkout";
import { formatMoney } from "@/lib/util";

export function SummaryCard({ paid }: { paid: Paid }) {
  const { sub, priced } = paid;
  const money = (c: number) => formatMoney(c, priced.currency);
  const row = (k: string, v: React.ReactNode) => <div className="grid grid-cols-[140px_1fr] gap-3 py-2.5"><dt className="text-muted">{k}</dt><dd className="font-medium text-ink">{v}</dd></div>;
  return (
    <div className="card mt-6 p-6">
      <dl className="divide-y divide-line text-sm">
        {row("Reference", <span className="font-mono">{paid.ref}</span>)}
        {sub.kind === "booking" ? (
          <>
            {row("Consultation", priced.lines[0].name)}
            {row("Preferred date", new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${sub.date}T00:00:00Z`)))}
            {row("Preferred time", `${sub.time}${sub.timezone ? ` (${sub.timezone})` : ""}`)}
          </>
        ) : priced.lines.map((l) => <div key={l.name}>{row(`${l.name}${l.quantity > 1 ? ` × ${l.quantity}` : ""}`, money(l.lineCents))}</div>)}
        {row("Amount paid", <strong>{money(paid.paidCents)}</strong>)}
        {row("Email", sub.customer.email)}
      </dl>
    </div>
  );
}
