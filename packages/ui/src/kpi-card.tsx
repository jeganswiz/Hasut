import type { CSSProperties, ReactNode } from "react";
import { cssVar } from "./tokens";

export function KpiCard({
  label,
  value,
  hint,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  hint?: ReactNode;
  tone?: "primary" | "secondary" | "success" | "warning";
}) {
  const style: CSSProperties = {
    background: cssVar(tone),
    color: cssVar("textOnPrimary"),
    borderRadius: cssVar("cardRadius"),
    padding: "20px 18px",
    minHeight: 112,
    display: "grid",
    gap: 8,
    alignContent: "space-between",
  };
  return (
    <article style={style}>
      <p style={{ margin: 0, opacity: 0.85, fontSize: 13, fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>{value}</p>
      {hint ? <p style={{ margin: 0, opacity: 0.85, fontSize: 12 }}>{hint}</p> : null}
    </article>
  );
}
