import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Book a Meeting | Qalb-E-Abbas", template: "%s | Qalb-E-Abbas" },
  description: "Book a paid consultation with Qalb-E-Abbas — choose a meeting type, pick a time, pay securely and get instant confirmation.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0B1B36" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
