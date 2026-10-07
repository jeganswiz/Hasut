"use client";

import { formatClock, type RangeValue } from "@hasut/ui";
import { TrimScrubber } from "./trim-scrubber";

export function VideoFilmstrip({
  src,
  duration,
  value,
  maxSpan,
  disabled,
  onChange,
  onScrub,
  onTogglePlay,
  playing,
}: {
  src: string;
  duration: number;
  value: RangeValue;
  maxSpan: number;
  disabled: boolean;
  onChange: (next: RangeValue) => void;
  onScrub: (seconds: number) => void;
  onTogglePlay: () => void;
  playing: boolean;
}) {
  return (
    <div className="ps-trim">
      <div className="ps-trim-label">
        <span>
          Keep {formatClock(value.end - value.start)} of {formatClock(duration)}. Drag either edge —
          the longest clip is {formatClock(maxSpan)}.
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
        <TrimScrubber
          duration={duration}
          value={value}
          maxSpan={maxSpan}
          disabled={disabled}
          onChange={onChange}
          onScrub={onScrub}
        >
          <video className="ps-film-video" src={src} muted playsInline />
        </TrimScrubber>
      </div>
      <div className="ps-trim-times">
        <span>{formatClock(value.start)}</span>
        <span>{formatClock(value.end)}</span>
      </div>
    </div>
  );
}
