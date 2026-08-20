import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signet Admin",
  description: "Back-office for Signet client stores, catalog, and orders",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
