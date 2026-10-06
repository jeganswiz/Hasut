"use client";

import { cn } from "./lib/utils";

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
      className="grid gap-1 rounded-sm border border-border bg-background p-1"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
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
            className={cn(
              "min-h-10 rounded-sm border-0 text-sm transition-colors",
              selected
                ? "bg-primary font-semibold text-primary-foreground"
                : "bg-transparent font-medium text-muted-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
