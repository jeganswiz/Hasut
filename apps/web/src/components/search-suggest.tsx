"use client";

import { SearchBar } from "@hasut/ui";
import { useEffect, useId, useRef, useState } from "react";
import type { SearchSuggestion, SuggestionGroup } from "../lib/discovery-chrome";

const GROUPS: SuggestionGroup[] = ["Service", "Professionals", "Businesses", "People"];

export function SearchSuggest({
  query,
  suggestions,
  onQueryChange,
  onPick,
}: {
  query: string;
  suggestions: SearchSuggestion[];
  onQueryChange: (value: string) => void;
  onPick: (suggestion: SearchSuggestion) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const visible = open && query.trim().length > 0 && suggestions.length > 0;
  const current = suggestions[active];

  useEffect(() => {
    setActive(0);
  }, [query, suggestions]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current === null || rootRef.current.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div className="search-suggest" ref={rootRef}>
      <SearchBar
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={listId}
        aria-activedescendant={
          visible && current !== undefined ? optionId(listId, current.key) : undefined
        }
        placeholder="Search services, people, businesses"
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!visible) {
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(suggestions.length - 1, index + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(0, index - 1));
          } else if (event.key === "Escape") {
            setOpen(false);
          } else if (event.key === "Enter" && current !== undefined) {
            event.preventDefault();
            onPick(current);
            setOpen(false);
          }
        }}
      />
      {visible ? (
        <ul className="search-suggest-list" id={listId} role="listbox">
          {GROUPS.map((group) => {
            const items = suggestions.filter((item) => item.group === group);
            if (items.length === 0) {
              return null;
            }
            return (
              <li key={group} className="search-suggest-group">
                <p>{group}</p>
                <ul>
                  {items.map((item) => {
                    const index = suggestions.indexOf(item);
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          id={optionId(listId, item.key)}
                          role="option"
                          aria-selected={index === active}
                          className={index === active ? "is-active" : undefined}
                          onMouseEnter={() => setActive(index)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            onPick(item);
                            setOpen(false);
                          }}
                        >
                          <strong>{item.label}</strong>
                          <span>{item.detail}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function optionId(listId: string, key: string): string {
  return `${listId}-${key.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
