import type { InputHTMLAttributes } from "react";
import { cssVar } from "./tokens";

export function SearchBar(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        boxSizing: "border-box",
        border: `1px solid ${cssVar("border")}`,
        background: cssVar("surface"),
        color: cssVar("text"),
        borderRadius: cssVar("cardRadius"),
        padding: "12px 16px",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
        ...props.style,
      }}
    />
  );
}
