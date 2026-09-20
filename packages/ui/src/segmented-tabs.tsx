"use client";

import { cssVar } from "./tokens";

export interface SegmentedTabsProps<T extends string> {
  tabs: ReadonlyArray<{ id: T; label: string }>;
  active: T;
  onChange: (id: T) => void;
  label: string;
}

/** One-of-N switch used for sign-in methods and for the story Activity / Live split. */
export function SegmentedTabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
        gap: 4,
        padding: 4,
        background: cssVar("background"),
        border: `1px solid ${cssVar("border")}`,
        borderRadius: cssVar("radius"),
      }}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            style={{
              minHeight: 40,
              fontSize: 14,
              fontWeight: selected ? 600 : 500,
              color: selected ? cssVar("textOnPrimary") : cssVar("mutedText"),
              background: selected ? cssVar("primary") : "transparent",
              border: "none",
              borderRadius: cssVar("radius"),
              cursor: "pointer",
              transition: "background 160ms ease, color 160ms ease",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
