import { ResetForm } from "@/components/AuthForms";
export const metadata = { title: "Choose a new password" };
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <div className="container-x max-w-md py-14"><div className="card p-7"><h1 className="mb-6 text-2xl font-extrabold">Choose a new password</h1>{token ? <ResetForm token={token} /> : <p className="err">Missing reset token.</p>}</div></div>;
}
