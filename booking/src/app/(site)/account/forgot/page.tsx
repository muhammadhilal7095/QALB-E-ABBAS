import { ForgotForm } from "@/components/AuthForms";
export const metadata = { title: "Forgot password" };
export default function Page() {
  return <div className="container-x max-w-md py-14"><div className="card p-7"><h1 className="text-2xl font-extrabold">Reset your password</h1><p className="mb-6 mt-1 text-sm">Enter your email and we&apos;ll send you a reset link.</p><ForgotForm /></div></div>;
}
