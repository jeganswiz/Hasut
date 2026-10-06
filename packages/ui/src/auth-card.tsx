"use client";

import type { ReactNode } from "react";
import { cn } from "./lib/utils";

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

export function AuthCard({
  tone = "member",
  eyebrow,
  title,
  lede,
  children,
  footer,
}: AuthCardProps) {
  const staff = tone === "staff";
  return (
    <main
      className={cn(
        "m-0 grid min-h-dvh max-w-none place-items-center px-4 py-6",
        staff ? "bg-foreground" : "bg-background",
      )}
    >
      <section
        data-tone={tone}
        className={cn(
          "grid w-full max-w-[420px] gap-[18px] border border-border bg-card p-7 text-foreground",
          staff ? "rounded-sm border-t-4 border-t-primary shadow-2xl" : "rounded-lg shadow-lg",
        )}
      >
        <header className="grid gap-1.5">
          {eyebrow === undefined ? null : (
            <div
              className={cn(
                "flex items-center gap-2 text-xs uppercase tracking-[0.12em]",
                staff ? "text-primary" : "text-muted-foreground",
              )}
            >
              {eyebrow}
            </div>
          )}
          <h1 className="m-0 text-2xl leading-tight">{title}</h1>
          {lede === undefined ? null : <p className="m-0 text-sm text-muted-foreground">{lede}</p>}
        </header>
        {children}
        {footer === undefined ? null : (
          <footer className="text-[13px] text-muted-foreground">{footer}</footer>
        )}
      </section>
    </main>
  );
}

/** Sign-in method switch. The generic control lives in `segmented-tabs`. */
export { SegmentedTabs as AuthTabs } from "./segmented-tabs";
export type { SegmentedTabsProps as AuthTabsProps } from "./segmented-tabs";
