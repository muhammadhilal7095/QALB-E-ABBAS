import { env, getSettings } from "@/lib/settings";
import LegalPage from "@/components/LegalPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking Terms and Conditions" };

export default async function Terms() {
  const s = await getSettings();
  return (
    <LegalPage title="Booking Terms and Conditions" updated={s.updatedAt.toISOString().slice(0, 10)}>
      <p>These terms apply to consultations booked through this booking system operated by {s.businessName}. They sit alongside the general <a className="text-brand" href={`${env.mainSiteUrl()}/terms.html`}>website terms</a>.</p>
      <h2>1. Booking a meeting</h2>
      <p>A booking is a request for an online consultation at the date and time you choose. Your selected time is reserved for a limited period while you complete payment. If payment is not completed in that period the reservation is released.</p>
      <h2>2. Confirmation</h2>
      <p>A booking is confirmed when we have received the required payment{s.manualApproval ? " and a member of our team has approved it" : ""}. You will receive a confirmation email with your booking reference. The meeting link is shared with you before the meeting.</p>
      <h2>3. Fees and payment</h2>
      <ul><li>The fee shown before payment is calculated by our system and includes any discount{s.taxRatePercent ? ` and ${s.taxLabel}` : ""}.</li><li>Card payments are processed by our payment provider. We do not see or store your full card details.</li><li>Where a deposit applies, the balance is due before or at the meeting.</li></ul>
      <h2>4. Cancellations, rescheduling and refunds</h2>
      <p>See our <a className="text-brand" href="/cancellation-policy">Cancellation &amp; Refund Policy</a>.</p>
      <h2>5. The consultation</h2>
      <p>Consultations provide general guidance based on the information you share. They are not legal, tax or financial advice unless agreed in writing. Please join on time — a late start does not extend the meeting.</p>
      <h2>6. Your information</h2>
      <p>We use the details you provide to arrange and deliver the meeting. See our <a className="text-brand" href="/privacy">Privacy Policy</a>.</p>
      <h2>7. Contact</h2>
      <p>Questions about a booking: <a className="text-brand" href={`mailto:${s.adminNotifyEmail}`}>{s.adminNotifyEmail}</a>.</p>
    </LegalPage>
  );
}
