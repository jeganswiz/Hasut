"use client";

import { cssVar } from "./tokens";

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
    <div
      role="radiogroup"
      aria-label={label}
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
    >
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
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: color,
              cursor: disabled ? "not-allowed" : "pointer",
              // The ring is drawn outside so it reads on white and black alike.
              border: `2px solid ${cssVar("surface")}`,
              boxShadow: selected
                ? `0 0 0 3px ${cssVar("primary")}`
                : `0 0 0 1px ${cssVar("border")}`,
              transition: "box-shadow 140ms ease",
            }}
          />
        );
      })}
    </div>
  );
}
