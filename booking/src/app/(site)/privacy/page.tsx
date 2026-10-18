import { env, getSettings } from "@/lib/settings";
import LegalPage from "@/components/LegalPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking Privacy Policy" };

export default async function Privacy() {
  const s = await getSettings();
  return (
    <LegalPage title="Booking Privacy Policy" updated={s.updatedAt.toISOString().slice(0, 10)}>
      <p>This notice explains how {s.businessName} handles personal information collected by the booking system. Our full <a className="text-brand" href={`${env.mainSiteUrl()}/privacy.html`}>website privacy policy</a> also applies.</p>
      <h2>What we collect</h2>
      <ul><li>Contact details: name, email, phone/WhatsApp number, company, website and country.</li><li>Meeting details you provide: purpose, requirements, questions and any files you upload.</li><li>Booking and payment records: dates, amounts, payment status and the payment provider&apos;s transaction reference. We never receive or store full card numbers.</li><li>Technical data needed for security, such as IP address for rate limiting and audit logs.</li></ul>
      <h2>Why we use it</h2>
      <p>To schedule and deliver your consultation, take payment, send confirmations and reminders, handle changes and refunds, keep records required by law, and protect the service from misuse.</p>
      <h2>Who we share it with</h2>
      <p>Only with service providers that help us run the booking system — our payment processor, email delivery provider and hosting provider — and only as needed for those purposes.</p>
      <h2>How long we keep it</h2>
      <p>Booking and payment records are kept for as long as required for accounting and tax purposes. You can ask us to delete your account and any data we are not required to keep.</p>
      <h2>Your rights</h2>
      <p>You can ask to access, correct or delete your data, or object to how we use it, by emailing <a className="text-brand" href={`mailto:${s.adminNotifyEmail}`}>{s.adminNotifyEmail}</a>.</p>
    </LegalPage>
  );
}
