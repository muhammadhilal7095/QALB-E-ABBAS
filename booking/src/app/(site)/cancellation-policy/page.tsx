import { getSettings } from "@/lib/settings";
import LegalPage from "@/components/LegalPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cancellation & Refund Policy" };

export default async function CancellationPolicy() {
  const s = await getSettings();
  return (
    <LegalPage title="Cancellation & Refund Policy" updated={s.updatedAt.toISOString().slice(0, 10)}>
      <h2>Cancelling or rescheduling</h2>
      <p className="whitespace-pre-line">{s.cancellationPolicy || "Our cancellation policy has not been published yet. Please contact us before cancelling."}</p>
      <h2>Refunds</h2>
      <p className="whitespace-pre-line">{s.refundPolicy || "Our refund policy has not been published yet. Please contact us about any refund."}</p>
      <h2>How to make a request</h2>
      <p>Open the link in your booking confirmation email (or sign in to <a className="text-brand" href="/account/meetings">My meetings</a>) and choose “Request reschedule” or “Request cancellation”. Our team will reply by email. Approved refunds are returned to the original payment method; your bank may take 5–10 working days to show the credit.</p>
      <h2>Payments that arrive after a reservation expired</h2>
      <p>If a payment is completed after your reserved time slot has been released, we will contact you to arrange a new time or refund the payment in full.</p>
    </LegalPage>
  );
}
