import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SimpleBookkeeping",
  description: "Corporate client compliance tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="cloud-white">
      <body>{children}</body>
    </html>
  );
}
