import type { ComponentProps } from "react";
import { cn } from "../lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="skeleton"
      className={cn("hasut-skeleton block rounded-md", className)}
      {...props}
    />
  );
}
