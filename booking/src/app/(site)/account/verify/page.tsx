import Link from "next/link";
import { prisma } from "@/lib/db";
import { consumeToken } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Verify email" };
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = token ? await consumeToken(token, "EMAIL_VERIFY") : null;
  if (t) await prisma.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } });
  return (
    <div className="container-x max-w-md py-14"><div className="card p-7">
      <h1 className="text-2xl font-extrabold">{t ? "Email verified" : "Link invalid or expired"}</h1>
      <p className="mt-2 text-sm">{t ? "Your account is now active." : "Please sign in and request a new verification email."}</p>
      <Link className="btn-primary mt-6" href="/account/login">Sign in</Link>
    </div></div>
  );
}
