import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/app-info";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: APP_NAME,
  description: `${APP_NAME}`,
  applicationName: APP_NAME,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#9a1a3c",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full bg-surface text-text">{children}<RegisterSW /></body>
    </html>
  );
}
