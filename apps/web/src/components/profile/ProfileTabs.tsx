import { cn } from "@hasut/ui";
import type { KeyboardEvent } from "react";

export interface ProfileTab {
  id: "presence" | "live" | "services";
  label: string;
}

export function ProfileTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly ProfileTab[];
  active: ProfileTab["id"];
  onChange: (id: ProfileTab["id"]) => void;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const next =
      event.key === "ArrowRight"
        ? tabs[(index + 1) % tabs.length]
        : event.key === "ArrowLeft"
          ? tabs[(index - 1 + tabs.length) % tabs.length]
          : event.key === "Home"
            ? tabs[0]
            : event.key === "End"
              ? tabs[tabs.length - 1]
              : undefined;
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    onChange(next.id);
    document.getElementById(`profile-tab-${next.id}`)?.focus();
  }

  return (
    <div
      className="sticky z-30 -mx-4 border-b border-border bg-background/95 px-4 backdrop-blur sm:-mx-4"
      style={{ top: "var(--chrome-height)" }}
    >
      <div role="tablist" aria-label="Profile sections" className="flex gap-6">
        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              id={`profile-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`profile-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={cn(
                "cursor-pointer border-x-0 border-t-0 border-b-2 border-solid bg-transparent px-0 py-3 font-sans text-sm font-medium transition-colors",
                selected
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
