import { LoginForm } from "@/components/AuthForms";
export const metadata = { title: "Admin sign in" };
export default function AdminLogin() {
  return (
    <div className="grid min-h-screen place-items-center bg-navy p-4">
      <div className="card w-full max-w-sm p-7">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Qalb-E-Abbas" className="h-9 w-auto" />
        <h1 className="mt-6 text-xl font-extrabold">Admin sign in</h1>
        <p className="mb-6 mt-1 text-sm">Team access to bookings, payments and settings.</p>
        <LoginForm admin />
      </div>
    </div>
  );
}
