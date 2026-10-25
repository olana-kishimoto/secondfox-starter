import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecondFox Starter",
  description: "SecondFoxの型スターター（最小構成）",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
