import { themeToCssText } from "@hasut/config";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "HASUT Admin",
  description: "HASUT operations console",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{themeToCssText()}</style>
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
