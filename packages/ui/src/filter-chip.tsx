import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cssVar } from "./tokens";

export function FilterChip({
  active = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      {...props}
      style={{
        border: `1px solid ${active ? cssVar("primary") : cssVar("border")}`,
        background: active ? cssVar("primary") : cssVar("surface"),
        color: active ? cssVar("textOnPrimary") : cssVar("text"),
        borderRadius: 999,
        padding: "8px 12px",
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}
