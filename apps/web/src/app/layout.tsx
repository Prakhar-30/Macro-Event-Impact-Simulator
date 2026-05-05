import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "macroscope",
  description:
    "Macro scenario impact simulator for equity portfolios — historical analogs, not forecasts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
