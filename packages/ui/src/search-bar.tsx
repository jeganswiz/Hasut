import type { InputHTMLAttributes } from "react";
import { cn } from "./lib/utils";

export function SearchBar({ className, style, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={style}
      className={cn(
        "w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground shadow-md outline-none",
        className,
      )}
    />
  );
}
