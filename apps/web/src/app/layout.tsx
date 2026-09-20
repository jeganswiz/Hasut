import { themeToCssText } from "@hasut/config";
import type { ReactNode } from "react";
import { ThemeBoot } from "../components/theme-boot";
import "./globals.css";

export const metadata = {
  title: "HASUT",
  description: "Location-intelligent professional and business network",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style id="hasut-theme">{themeToCssText()}</style>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <meta name="theme-color" content="#6D28D9" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body suppressHydrationWarning>
        <ThemeBoot />
        {children}
      </body>
    </html>
  );
}
