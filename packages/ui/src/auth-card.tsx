"use client";

import type { CSSProperties, ReactNode } from "react";
import { cssVar } from "./tokens";

/**
 * `staff` gives the admin console its own sign-in identity: darker canvas,
 * squared frame, and an accent rail. Same tokens, deliberately different feel.
 */
export type AuthTone = "member" | "staff";

export interface AuthCardProps {
  tone?: AuthTone;
  eyebrow?: ReactNode;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

function pageStyle(tone: AuthTone): CSSProperties {
  return {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    // Overrides the app shell's centered column so the canvas is full bleed.
    maxWidth: "none",
    margin: 0,
    padding: "24px 16px",
    background: tone === "staff" ? cssVar("text") : cssVar("background"),
  };
}

function cardStyle(tone: AuthTone): CSSProperties {
  const staff = tone === "staff";
  return {
    width: "100%",
    maxWidth: 420,
    background: cssVar("surface"),
    color: cssVar("text"),
    border: `1px solid ${cssVar("border")}`,
    borderTop: staff ? `4px solid ${cssVar("primary")}` : `1px solid ${cssVar("border")}`,
    borderRadius: staff ? 8 : cssVar("cardRadius"),
    padding: 28,
    boxShadow: staff ? "0 24px 60px rgba(0,0,0,0.38)" : "0 12px 32px rgba(0,0,0,0.10)",
    display: "grid",
    gap: 18,
  };
}

export function AuthCard({
  tone = "member",
  eyebrow,
  title,
  lede,
  children,
  footer,
}: AuthCardProps) {
  return (
    <main style={pageStyle(tone)}>
      <section style={cardStyle(tone)} data-tone={tone}>
        <header style={{ display: "grid", gap: 6 }}>
          {eyebrow === undefined ? null : (
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: tone === "staff" ? cssVar("primary") : cssVar("mutedText"),
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {eyebrow}
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.25 }}>{title}</h1>
          {lede === undefined ? null : (
            <p style={{ margin: 0, fontSize: 14, color: cssVar("mutedText") }}>{lede}</p>
          )}
        </header>
        {children}
        {footer === undefined ? null : (
          <footer style={{ fontSize: 13, color: cssVar("mutedText") }}>{footer}</footer>
        )}
      </section>
    </main>
  );
}

/** Sign-in method switch. The generic control lives in `segmented-tabs`. */
export { SegmentedTabs as AuthTabs } from "./segmented-tabs";
export type { SegmentedTabsProps as AuthTabsProps } from "./segmented-tabs";
