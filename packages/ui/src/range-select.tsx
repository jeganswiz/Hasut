"use client";

import { useId } from "react";
import { formatClock, moveHandle, type RangeBounds, type RangeValue } from "./range-select.logic";
import { cssVar } from "./tokens";

export interface RangeSelectProps {
  label: string;
  value: RangeValue;
  onChange: (next: RangeValue) => void;
  bounds: RangeBounds;
  disabled?: boolean;
  /** Optional caption under the track, e.g. the selected length. */
  hint?: string;
}

/**
 * Two-handle scrubber for trimming a clip or picking a slice of a soundtrack.
 * Built from two native range inputs so keyboard and screen-reader support come
 * for free; the coloured bar behind them is presentation only.
 */
export function RangeSelect({
  label,
  value,
  onChange,
  bounds,
  disabled = false,
  hint,
}: RangeSelectProps) {
  const id = useId();
  const duration = Math.max(1, Math.round(bounds.duration));
  const startPercent = (value.start / duration) * 100;
  const endPercent = (value.end / duration) * 100;
  const span = value.end - value.start;

  const handleStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    margin: 0,
    // Both inputs stack on the same track; only the thumbs stay interactive.
    background: "transparent",
    pointerEvents: "none",
    appearance: "none",
    WebkitAppearance: "none",
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
        <span style={{ color: cssVar("mutedText") }}>{label}</span>
        <span style={{ color: cssVar("text"), fontVariantNumeric: "tabular-nums" }}>
          {formatClock(value.start)} – {formatClock(value.end)}
        </span>
      </div>

      <div
        style={{
          position: "relative",
          height: 36,
          display: "flex",
          alignItems: "center",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 8,
            borderRadius: 999,
            background: cssVar("border"),
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: `${startPercent}%`,
            width: `${Math.max(0, endPercent - startPercent)}%`,
            height: 8,
            borderRadius: 999,
            background: cssVar("primary"),
          }}
        />
        <input
          id={`${id}-start`}
          type="range"
          min={0}
          max={duration}
          step={1}
          value={value.start}
          disabled={disabled}
          aria-label={`${label} start`}
          aria-valuetext={formatClock(value.start)}
          onChange={(event) =>
            onChange(moveHandle(value, "start", Number(event.target.value), bounds))
          }
          style={handleStyle}
          className="hasut-range-handle"
        />
        <input
          id={`${id}-end`}
          type="range"
          min={0}
          max={duration}
          step={1}
          value={value.end}
          disabled={disabled}
          aria-label={`${label} end`}
          aria-valuetext={formatClock(value.end)}
          onChange={(event) =>
            onChange(moveHandle(value, "end", Number(event.target.value), bounds))
          }
          style={handleStyle}
          className="hasut-range-handle"
        />
      </div>

      <p style={{ margin: 0, fontSize: 13, color: cssVar("mutedText") }}>
        {hint ?? `${formatClock(span)} selected`}
      </p>
    </div>
  );
}
