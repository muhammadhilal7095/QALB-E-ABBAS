import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import BookingWizard from "@/components/BookingWizard";

export const dynamic = "force-dynamic";

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [services, settings, user] = await Promise.all([
    prisma.meetingService.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    getSettings(),
    getCurrentUser(),
  ]);
  const service = services.find((s) => s.slug === slug);
  if (!service) notFound();
  if (!settings.allowGuestBooking && !user) redirect(`/account/login?next=/book/${slug}`);

  let prefill = {};
  if (user?.role === "CLIENT") {
    const c = await prisma.client.findUnique({ where: { userId: user.id } });
    const m = c?.phone?.match(/^(\+\d{1,3})(\d+)$/);
    prefill = { clientName: c?.name ?? user.name, clientEmail: user.email, company: c?.company ?? "", website: c?.website ?? "", country: c?.country ?? "", ...(m ? { dial: m[1], phone: m[2] } : {}) };
  }

  return (
    <div className="container-x py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted">
        <Link href="/" className="hover:text-brand">Book a Meeting</Link> <span aria-hidden>/</span> <span className="text-ink">{service.name}</span>
      </nav>
      <h1 className="mb-6 text-2xl font-extrabold md:text-3xl">Book: {service.name}</h1>
      <BookingWizard
        services={services.map((s) => ({ id: s.id, slug: s.slug, name: s.name, description: s.description, durationMin: s.durationMin, priceCents: s.priceCents, currency: s.currency, paymentRequirement: s.paymentRequirement, depositPercent: s.depositPercent }))}
        initialServiceId={service.id}
        prefill={prefill}
        taxLabel={settings.taxLabel}
        termsUrl="/terms"
        policyUrl="/cancellation-policy"
      />
    </div>
  );
}
