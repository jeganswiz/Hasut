"use client";

import { formatClock, moveHandle, normalizeRange, type RangeValue } from "@hasut/ui";

export function VideoFilmstrip({
  src,
  duration,
  value,
  maxSpan,
  disabled,
  onChange,
  onTogglePlay,
  playing,
}: {
  src: string;
  duration: number;
  value: RangeValue;
  maxSpan: number;
  disabled: boolean;
  onChange: (next: RangeValue) => void;
  onTogglePlay: () => void;
  playing: boolean;
}) {
  const bounds = { duration, maxSpan, minSpan: 1 };
  const span = Math.max(1, Math.round(duration));
  const start = (value.start / span) * 100;
  const end = (value.end / span) * 100;

  function setHandle(handle: "start" | "end", raw: number): void {
    onChange(normalizeRange(moveHandle(value, handle, raw, bounds), bounds));
  }

  return (
    <div className="ps-trim">
      <div className="ps-trim-label">
        <span>
          Trim video ({formatClock(value.end - value.start)} / {formatClock(duration)})
        </span>
      </div>
      <div className="ps-film">
        <button
          type="button"
          className="ps-play"
          aria-label={playing ? "Pause" : "Play"}
          disabled={disabled}
          onClick={onTogglePlay}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <div className="ps-film-track">
          <video className="ps-film-video" src={src} muted playsInline />
          <div className="ps-film-dim ps-film-dim-start" style={{ width: `${start}%` }} />
          <div className="ps-film-dim ps-film-dim-end" style={{ width: `${100 - end}%` }} />
          <div
            className="ps-film-window"
            style={{ left: `${start}%`, width: `${Math.max(0, end - start)}%` }}
          />
          <input
            className="ps-film-range"
            type="range"
            min={0}
            max={span}
            value={value.start}
            disabled={disabled}
            aria-label="Trim start"
            onChange={(event) => setHandle("start", Number(event.target.value))}
          />
          <input
            className="ps-film-range"
            type="range"
            min={0}
            max={span}
            value={value.end}
            disabled={disabled}
            aria-label="Trim end"
            onChange={(event) => setHandle("end", Number(event.target.value))}
          />
        </div>
      </div>
      <div className="ps-trim-times">
        <span>{formatClock(value.start)}</span>
        <span>{formatClock(value.end)}</span>
      </div>
    </div>
  );
}
