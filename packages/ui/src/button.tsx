import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cssVar } from "./tokens";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary";
}

export function Button({ children, variant = "primary", style, type, ...props }: ButtonProps) {
  const background = variant === "primary" ? cssVar("primary") : cssVar("surface");
  const color = variant === "primary" ? cssVar("textOnPrimary") : cssVar("text");
  const border = variant === "primary" ? "1px solid transparent" : `1px solid ${cssVar("border")}`;

  return (
    <button
      type={type ?? "button"}
      style={{
        background,
        color,
        border,
        borderRadius: cssVar("buttonRadius"),
        padding: "10px 16px",
        fontWeight: 600,
        cursor: "pointer",
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
