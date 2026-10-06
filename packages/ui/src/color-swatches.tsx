"use client";

import { cn } from "./lib/utils";

export interface ColorSwatchesProps {
  label: string;
  /** Palette from configuration. Components never invent their own colours. */
  colors: readonly string[];
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
}

/** Caption colour picker. Selecting the active swatch clears the choice. */
export function ColorSwatches({
  label,
  colors,
  value,
  onChange,
  disabled = false,
}: ColorSwatchesProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2">
      {colors.map((color) => {
        const selected = value !== null && value.toLowerCase() === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            disabled={disabled}
            onClick={() => onChange(selected ? null : color)}
            className={cn(
              "size-8 rounded-full border-2 border-card transition-shadow disabled:cursor-not-allowed",
              selected
                ? "shadow-[0_0_0_3px_var(--hasut-color-primary)]"
                : "shadow-[0_0_0_1px_var(--hasut-color-border)]",
            )}
            style={{ background: color }}
          />
        );
      })}
    </div>
  );
}
