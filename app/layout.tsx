import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Store CRM",
  description: "Simple store CRM learning vehicle",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
