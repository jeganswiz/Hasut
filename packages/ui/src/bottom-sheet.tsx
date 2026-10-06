import type { ReactNode } from "react";

export function BottomSheet({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-t-lg bg-card px-4 pb-5 pt-2 shadow-[0_-12px_40px_color-mix(in_srgb,var(--hasut-color-text)_12%,transparent)]">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
      {children}
    </section>
  );
}
