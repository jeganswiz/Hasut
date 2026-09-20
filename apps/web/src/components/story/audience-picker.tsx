"use client";

import type { StoryAudience } from "@hasut/types";
import { cssVar } from "@hasut/ui";

export interface AudiencePickerProps {
  value: StoryAudience;
  onChange: (next: StoryAudience) => void;
  patronCount: number;
  disabled?: boolean;
}

function patronLabel(count: number): string {
  if (count === 0) {
    return "Patrons only";
  }
  return `Patrons only (${count})`;
}

/**
 * Everyone versus Patrons. "Patrons" is HASUT's word for accepted connections
 * — a mutual relationship, not a one-way follow.
 */
export function AudiencePicker({
  value,
  onChange,
  patronCount,
  disabled = false,
}: AudiencePickerProps) {
  const options: Array<{ id: StoryAudience; label: string; hint: string }> = [
    {
      id: "EVERYONE",
      label: "Everyone nearby",
      hint: "Anyone who finds you on the discovery map.",
    },
    {
      id: "PATRONS",
      label: patronLabel(patronCount),
      hint:
        patronCount === 0
          ? "You have no accepted connections yet, so nobody would see this."
          : "Only the people you have accepted a connection with.",
    },
  ];

  const active = options.find((option) => option.id === value) ?? options[0];

  return (
    <fieldset style={{ margin: 0, padding: 0, border: "none", display: "grid", gap: 6 }}>
      <legend style={{ padding: 0, fontSize: 14, color: cssVar("mutedText") }}>Audience</legend>
      <div role="radiogroup" aria-label="Audience" style={{ display: "flex", gap: 6 }}>
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              style={{
                minHeight: 36,
                padding: "0 14px",
                fontSize: 13,
                borderRadius: 999,
                cursor: disabled ? "not-allowed" : "pointer",
                border: `1px solid ${selected ? cssVar("primary") : cssVar("border")}`,
                background: selected ? cssVar("primary") : cssVar("surface"),
                color: selected ? cssVar("textOnPrimary") : cssVar("mutedText"),
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: cssVar("mutedText") }}>{active?.hint}</p>
    </fieldset>
  );
}
