import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes the way shadcn components expect. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
