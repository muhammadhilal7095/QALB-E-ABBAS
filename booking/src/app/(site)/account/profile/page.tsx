import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import AccountNav from "@/components/AccountNav";
import { ProfileForm } from "@/components/AuthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

export default async function Profile() {
  const user = await requireUser(["CLIENT"]);
  const c = await prisma.client.findUnique({ where: { userId: user.id } });
  return (
    <div className="container-x py-10">
      <AccountNav active="/account/profile" name={user.name} />
      <div className="card max-w-2xl p-6">
        <p className="mb-4 text-sm">Signed in as <b className="text-ink">{user.email}</b></p>
        <ProfileForm initial={{ name: user.name, phone: c?.phone ?? "", company: c?.company ?? "", website: c?.website ?? "", country: c?.country ?? "" }} />
      </div>
    </div>
  );
}
