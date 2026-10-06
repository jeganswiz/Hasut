import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./lib/utils";

export function FilterChip({
  active = false,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      {...props}
      aria-pressed={active}
      className={cn(
        "whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
