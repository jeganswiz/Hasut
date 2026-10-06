"use client";

import type { DiscoveryStoryFace } from "@hasut/types";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { buildStoryTray, hasStoryRing, readWatchedStoryIds } from "../lib/story-ring";

export function StoryTray({
  selfId,
  selfLabel,
  selfImageUrl,
  selfKind,
  faces,
  hint = "",
}: {
  selfId: string | null;
  selfLabel: string;
  selfImageUrl: string | null;
  selfKind: "LIVE" | "VIDEO" | "IMAGE" | null;
  faces: DiscoveryStoryFace[];
  hint?: string;
}) {
  const [watched, setWatched] = useState<string[]>([]);

  useEffect(() => {
    const read = () => setWatched(readWatchedStoryIds(window.localStorage));
    read();
    window.addEventListener("focus", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("focus", read);
      window.removeEventListener("storage", read);
    };
  }, [faces, selfId]);

  const tray = buildStoryTray({
    selfId,
    selfLabel,
    selfImageUrl,
    selfKind,
    faces,
  });
  if (tray.length === 0) {
    return null;
  }

  return (
    <div className="story-tray" aria-label="Stories">
      {tray.map((face) => {
        const active = hasStoryRing(face.kind);
        const seen = watched.includes(face.memberId);
        const ringClass = !active ? "is-empty" : seen ? "is-seen" : "is-unseen";
        const href = active ? `/stories/${face.memberId}` : "/story";
        return (
          <div className="story-tray-item" key={face.memberId}>
            <a className={`story-tray-ring ${ringClass}`} href={href} aria-label={face.label}>
              {face.imageUrl !== null ? (
                <img src={face.imageUrl} alt="" />
              ) : (
                <span>{initials(face.label)}</span>
              )}
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
