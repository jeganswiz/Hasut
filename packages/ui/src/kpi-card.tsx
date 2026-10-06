import type { ReactNode } from "react";
import { cn } from "./lib/utils";

const TONE = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  success: "bg-success",
  warning: "bg-warning",
} as const;

export function KpiCard({
  label,
  value,
  hint,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  hint?: ReactNode;
  tone?: keyof typeof TONE;
}) {
  return (
    <article
      className={cn(
        "grid min-h-28 content-between gap-2 rounded-lg p-5 text-primary-foreground",
        TONE[tone],
      )}
    >
      <p className="m-0 text-[13px] font-semibold opacity-85">{label}</p>
      <p className="m-0 text-[28px] font-bold tracking-tight">{value}</p>
      {hint ? <p className="m-0 text-xs opacity-85">{hint}</p> : null}
    </article>
  );
}
