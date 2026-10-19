"use client";

import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { prefersReducedMotion } from "../lib/pull-refresh";
import {
  isCompactDiscovery,
  nearestSheetSnap,
  sheetHeight,
  snapAfterDrag,
  type SheetSnap,
} from "../lib/sheet-snap";

export function DiscoverySheet({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<SheetSnap>("half");
  const [compact, setCompact] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [viewport, setViewport] = useState(800);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 859px)");
    const sync = () => {
      setCompact(isCompactDiscovery(window.innerWidth) || media.matches);
      setViewport(window.innerHeight);
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  const height = dragHeight ?? sheetHeight(snap, viewport);

  function onHandleDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!compact) {
      return;
    }
    const originY = event.clientY;
    const originHeight = height;
    let latest = originHeight;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    const onMove = (move: PointerEvent) => {
      latest = Math.min(
        viewport * 0.92,
        Math.max(viewport * 0.16, originHeight + (originY - move.clientY)),
      );
      setDragHeight(latest);
    };
    const onUp = (up: PointerEvent) => {
      target.releasePointerCapture(up.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      const dy = up.clientY - originY;
      const reduced = prefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)"));
      setSnap(reduced ? nearestSheetSnap(latest, viewport) : snapAfterDrag(snap, dy));
      setDragHeight(null);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  return (
    <section
      className={compact ? "discovery-sheet is-overlay" : "discovery-sheet"}
      data-snap={snap}
      data-results-sheet="true"
      style={compact ? { height } : undefined}
      aria-label="Nearby results"
    >
      <div className="discovery-sheet-handle-row" onPointerDown={onHandleDown}>
        <div className="discovery-sheet-handle" />
      </div>
      <div className="discovery-sheet-body">{children}</div>
    </section>
  );
}
