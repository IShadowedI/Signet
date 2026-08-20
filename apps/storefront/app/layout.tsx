import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signet Storefront",
  description: "Multi-tenant B2B apparel storefront",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
