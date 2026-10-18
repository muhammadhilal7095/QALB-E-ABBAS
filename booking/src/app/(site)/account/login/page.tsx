import { LoginForm } from "@/components/AuthForms";
export const metadata = { title: "Sign in" };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="container-x max-w-md py-14">
      <div className="card p-7"><h1 className="text-2xl font-extrabold">Sign in</h1><p className="mb-6 mt-1 text-sm">View your meetings, receipts and booking history.</p><LoginForm next={next} /></div>
      <p className="mt-4 text-center text-sm text-muted">You can also book as a guest — no account needed.</p>
    </div>
  );
}
