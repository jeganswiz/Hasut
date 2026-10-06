"use client";

import type { DiscoveryStoryFace } from "@hasut/types";
import { useState } from "react";
import { createPortal } from "react-dom";
import { buildStoryTray, profileRingClass, profileRingState } from "../lib/story-ring";

export function StoryTray({
  selfId,
  selfLabel,
  selfImageUrl,
  selfKind,
  selfStoryIds = [],
  faces,
  watchedStoryIds = [],
  hint = "",
}: {
  selfId: string | null;
  selfLabel: string;
  selfImageUrl: string | null;
  selfKind: "LIVE" | "VIDEO" | "IMAGE" | null;
  selfStoryIds?: readonly string[];
  faces: DiscoveryStoryFace[];
  watchedStoryIds?: readonly string[];
  hint?: string;
}) {
  const tray = buildStoryTray({
    selfId,
    selfLabel,
    selfImageUrl,
    selfKind,
    selfStoryIds,
    faces,
  });
  if (tray.length === 0) {
    return null;
  }

  return (
    <div className="story-tray" aria-label="Stories">
      {tray.map((face) => {
        const state = profileRingState({
          live: face.kind === "LIVE",
          storyIds: face.storyIds ?? [],
          watchedStoryIds,
        });
        const ringClass = profileRingClass(state);
        const href = state === "none" ? "/story" : `/stories/${face.memberId}`;
        return (
          <div className="story-tray-item" key={face.memberId}>
            <a
              className={`story-tray-ring ${ringClass}`.trim()}
              href={href}
              aria-label={face.label}
            >
              {face.imageUrl !== null ? (
                <img src={face.imageUrl} alt="" />
              ) : (
                <span>{initials(face.label)}</span>
              )}
              {state === "live" ? <em>LIVE</em> : null}
            </a>
            {face.self ? <AddPresence hint={hint} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function AddPresence({ hint }: { hint: string }) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  function show(target: HTMLElement): void {
    if (hint.length === 0) {
      return;
    }
    const rect = target.getBoundingClientRect();
    setTip({ x: rect.left + rect.width / 2, y: rect.top });
  }

  return (
    <a
      className="story-tray-add"
      href="/story"
      aria-label="Add presence"
      aria-describedby={tip !== null ? "story-add-tip" : undefined}
      onMouseEnter={(event) => show(event.currentTarget)}
      onMouseLeave={() => setTip(null)}
      onFocus={(event) => show(event.currentTarget)}
      onBlur={() => setTip(null)}
    >
      <PlusIcon />
      {tip !== null
        ? createPortal(
            <span
              id="story-add-tip"
              role="tooltip"
              className="story-add-tip"
              style={{ left: tip.x, top: tip.y }}
            >
              {hint}
            </span>,
            document.body,
          )
        : null}
    </a>
  );
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part.slice(0, 1).toUpperCase()).join("");
  return letters.length > 0 ? letters : "You";
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
