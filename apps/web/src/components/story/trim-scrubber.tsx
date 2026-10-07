"use client";

import { moveHandle, normalizeRange, type RangeBounds, type RangeValue } from "@hasut/ui";
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

/**
 * Front and back handles for a clip. Dragging either edge seeks playback to that
 * edge so the member hears the cut immediately.
 */
export function TrimScrubber({
  duration,
  value,
  maxSpan,
  minSpan = 1,
  disabled,
  onChange,
  onScrub,
  children,
}: {
  duration: number;
  value: RangeValue;
  maxSpan: number;
  minSpan?: number;
  disabled: boolean;
  onChange: (next: RangeValue) => void;
  onScrub: (seconds: number) => void;
  children?: ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const bounds: RangeBounds = { duration, maxSpan, minSpan };
  const start = duration <= 0 ? 0 : (value.start / duration) * 100;
  const end = duration <= 0 ? 0 : (value.end / duration) * 100;

  function begin(event: ReactPointerEvent<HTMLElement>, mode: "start" | "end" | "move"): void {
    if (disabled || duration <= 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const track = trackRef.current;
    if (track === null) {
      return;
    }
    const rect = track.getBoundingClientRect();
    const origin = value;
    const pointerStart = event.clientX;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const apply = (next: RangeValue, preview: number): void => {
      onChange(next);
      onScrub(preview);
    };
    apply(origin, mode === "end" ? Math.max(origin.start, origin.end - 0.2) : origin.start);

    const move = (ev: PointerEvent): void => {
      const dx = ((ev.clientX - pointerStart) / Math.max(1, rect.width)) * duration;
      if (mode === "move") {
        const span = origin.end - origin.start;
        const nextStart = clamp(origin.start + dx, 0, Math.max(0, duration - span));
        const next = normalizeRange({ start: nextStart, end: nextStart + span }, bounds);
        apply(next, next.start);
        return;
      }
      const raw = mode === "start" ? origin.start + dx : origin.end + dx;
      const next = moveHandle(origin, mode, raw, bounds);
      apply(next, mode === "end" ? Math.max(next.start, next.end - 0.2) : next.start);
    };
    const endDrag = (): void => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", endDrag);
      target.removeEventListener("pointercancel", endDrag);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", endDrag);
    target.addEventListener("pointercancel", endDrag);
  }

  function nudge(handle: "start" | "end", delta: number): void {
    const next = moveHandle(
      value,
      handle,
      (handle === "start" ? value.start : value.end) + delta,
      bounds,
    );
    onChange(next);
    onScrub(handle === "end" ? Math.max(next.start, next.end - 0.2) : next.start);
  }

  return (
    <div ref={trackRef} className="ps-film-track">
      {children}
      <div className="ps-film-dim ps-film-dim-start" style={{ width: `${start}%` }} />
      <div className="ps-film-dim ps-film-dim-end" style={{ width: `${100 - end}%` }} />
      <div
        className="ps-film-window"
        style={{ left: `${start}%`, width: `${Math.max(0, end - start)}%` }}
        onPointerDown={(event) => begin(event, "move")}
      />
      <button
        type="button"
        className="ps-trim-handle ps-trim-handle-start"
        style={{ left: `${start}%` }}
        aria-label="Trim from the start"
        disabled={disabled}
        onPointerDown={(event) => begin(event, "start")}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            nudge("start", event.shiftKey ? -5 : -1);
          }
          if (event.key === "ArrowRight") {
            nudge("start", event.shiftKey ? 5 : 1);
          }
        }}
      />
      <button
        type="button"
        className="ps-trim-handle ps-trim-handle-end"
        style={{ left: `${end}%` }}
        aria-label="Trim from the end"
        disabled={disabled}
        onPointerDown={(event) => begin(event, "end")}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            nudge("end", event.shiftKey ? -5 : -1);
          }
          if (event.key === "ArrowRight") {
            nudge("end", event.shiftKey ? 5 : 1);
          }
        }}
      />
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
