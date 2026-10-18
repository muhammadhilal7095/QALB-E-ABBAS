import { RegisterForm } from "@/components/AuthForms";
export const metadata = { title: "Create account" };
export default function Page() {
  return <div className="container-x max-w-md py-14"><div className="card p-7"><h1 className="text-2xl font-extrabold">Create your account</h1><p className="mb-6 mt-1 text-sm">Keep all your meetings, receipts and requests in one place.</p><RegisterForm /></div></div>;
}
