import { env } from "@/lib/env";
import { paidFromSession, priceSubmission, readPayload, sendPaidEmails, type Paid, type Submission } from "@/lib/checkout";
import { SummaryCard } from "@/components/SummaryCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thank you" };

export default async function ThankYou({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  let paid: Paid | null = null;
  let problem = false;
  try {
    if (sp.session_id && env.stripeConfigured()) {
      paid = await paidFromSession(sp.session_id);
      // Backup for the webhook: sending again is harmless (each email is sent only once).
      if (paid) await sendPaidEmails(paid).catch((e) => console.error("Thank-you page email send failed", e));
    } else if (sp.p && env.testPaymentsEnabled()) {
      const d = readPayload<{ ref: string; sub: Submission; paid?: boolean }>(sp.p);
      if (d.paid) { const priced = priceSubmission(d.sub, { checkDate: false }); paid = { ref: d.ref, sub: d.sub, priced, paidCents: priced.totalCents, paymentId: `test_${d.ref}` }; }
    }
  } catch (e) {
    console.error(e);
    problem = true;
  }
  const site = env.mainSiteUrl();

  if (!paid) {
    return (
      <div className="container-x max-w-2xl py-14">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900" role="status">
          <h1 className="font-display text-2xl font-extrabold">{problem ? "We couldn't confirm your payment yet" : "No payment found"}</h1>
          <p className="mt-2 text-sm">If you completed a payment, you'll receive a confirmation email shortly. If anything looks wrong, contact us at <a className="font-semibold underline" href="mailto:contact@qalbeabbas.com">contact@qalbeabbas.com</a>.</p>
        </div>
        <p className="mt-8 text-center"><a className="btn-gold" href={site}>Back to the website</a></p>
      </div>
    );
  }
  const booking = paid.sub.kind === "booking";
  return (
    <div className="container-x max-w-2xl py-14">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-green-900" role="status">
        <p className="eyebrow !text-green-700">Payment successful</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold md:text-3xl">Thank you, {paid.sub.customer.name.split(" ")[0]}!</h1>
        <p className="mt-2 text-sm leading-relaxed">
          {booking
            ? "Your consultation request and payment have been received. Our team will contact you within one working day to confirm your time and send the meeting link."
            : "Your order and payment have been received. Our team will contact you within one working day to get started."}
          {" "}A confirmation has been emailed to <strong>{paid.sub.customer.email}</strong>.
        </p>
      </div>
      <SummaryCard paid={paid} />
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a className="btn-gold" href={site}>Back to the website</a>
        <a className="btn-ghost" href={`${site}/services`}>Explore more services</a>
      </div>
    </div>
  );
}
