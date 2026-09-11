import { themeToCssText } from "@hasut/config";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "HASUT",
  description: "Location-intelligent professional and business network",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{themeToCssText()}</style>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
