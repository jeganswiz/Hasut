"use client";

import { SearchBar } from "@hasut/ui";
import { useEffect, useId, useRef, useState } from "react";
import type { SearchSuggestion, SuggestionGroup } from "../lib/discovery-chrome";

const GROUPS: SuggestionGroup[] = ["Service", "Professionals", "Businesses", "People"];

const PLACEHOLDER = "Find product, service, professionals, businesses";
const MOBILE_PLACEHOLDER = "Find nearby";

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
  const [asking, setAsking] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const visible = open && query.trim().length > 0 && suggestions.length > 0;
  const current = suggestions[active];

  useEffect(() => {
    setActive(0);
  }, [query, suggestions]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 859px)");
    const apply = () => setNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        rootRef.current === null ||
        rootRef.current.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setAsking(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function close(): void {
    setOpen(false);
    setAsking(false);
    setFocused(false);
  }

  function openMobile(): void {
    setAsking(true);
    window.requestAnimationFrame(() => {
      rootRef.current?.querySelector("input")?.focus();
    });
  }

  return (
    <div className={asking ? "nav-search is-asking" : "nav-search"} ref={rootRef}>
      <button
        type="button"
        className="nav-search-toggle"
        aria-label={PLACEHOLDER}
        onClick={openMobile}
      >
        <LensIcon />
      </button>
      <div className="nav-search-panel">
        <label className="nav-search-field">
          <span className={focused ? "nav-search-glow is-focused" : "nav-search-glow"}>
            <LensIcon />
            <SearchBar
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={visible}
              aria-controls={listId}
              aria-label={PLACEHOLDER}
              aria-activedescendant={
                visible && current !== undefined ? optionId(listId, current.key) : undefined
              }
              placeholder={narrow ? MOBILE_PLACEHOLDER : PLACEHOLDER}
              value={query}
              style={{
                padding: narrow ? "8px 76px 8px 40px" : "8px 16px 8px 40px",
                boxShadow: "none",
                borderColor: focused ? "var(--hasut-color-primary)" : undefined,
              }}
              onChange={(event) => {
                onQueryChange(event.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                setFocused(true);
                setOpen(true);
              }}
              onBlur={() => setFocused(false)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  close();
                  return;
                }
                if (!visible) {
                  return;
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((index) => Math.min(suggestions.length - 1, index + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((index) => Math.max(0, index - 1));
                } else if (event.key === "Enter" && current !== undefined) {
                  event.preventDefault();
                  onPick(current);
                  close();
                }
              }}
            />
          </span>
          <button
            type="button"
            className="nav-search-close"
            aria-label="Close search"
            onClick={close}
          >
            Close
          </button>
        </label>
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
                              close();
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
    </div>
  );
}

function LensIcon() {
  return (
    <svg className="nav-search-lens" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16.5 20 20.5" />
    </svg>
  );
}

function optionId(listId: string, key: string): string {
  return `${listId}-${key.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
