import { themeToCssText } from "@hasut/config";
import type { ReactNode } from "react";
import { ThemeBoot } from "../components/theme-boot";
import "./globals.css";

export const metadata = {
  title: "HASUT Admin",
  description: "HASUT operations console",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style id="hasut-theme">{themeToCssText()}</style>
      </head>
      <body suppressHydrationWarning>
        <ThemeBoot />
        {children}
      </body>
    </html>
  );
}
