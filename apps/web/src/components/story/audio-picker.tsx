"use client";

import type { AudioTrackView, StoryAudioSource } from "@hasut/types";
import { RangeSelect, cssVar, formatClock, normalizeRange, type RangeValue } from "@hasut/ui";
import { useMemo, useRef, useState } from "react";

export interface AudioChoice {
  source: StoryAudioSource;
  trackId: string | null;
  file: File | null;
  segment: RangeValue;
  /** Length of the chosen source, used to bound the segment handles. */
  durationSeconds: number;
}

export const NO_AUDIO: AudioChoice = {
  source: "NONE",
  trackId: null,
  file: null,
  segment: { start: 0, end: 0 },
  durationSeconds: 0,
};

export interface AudioPickerProps {
  tracks: AudioTrackView[];
  libraryEnabled: boolean;
  maxSegmentSeconds: number;
  value: AudioChoice;
  onChange: (next: AudioChoice) => void;
  disabled?: boolean;
}

function readAudioDuration(objectUrl: string): Promise<number | null> {
  return new Promise((resolve) => {
    const probe = document.createElement("audio");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      resolve(Number.isFinite(probe.duration) ? probe.duration : null);
    };
    probe.onerror = () => {
      resolve(null);
    };
    probe.src = objectUrl;
  });
}

export function AudioPicker({
  tracks,
  libraryEnabled,
  maxSegmentSeconds,
  value,
  onChange,
  disabled = false,
}: AudioPickerProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mood, setMood] = useState<string>("All");

  const moods = useMemo(() => {
    const unique = new Set(tracks.map((track) => track.mood));
    return ["All", ...[...unique].sort((a, b) => a.localeCompare(b))];
  }, [tracks]);

  const visible = mood === "All" ? tracks : tracks.filter((track) => track.mood === mood);
  const bounds = { duration: value.durationSeconds, maxSpan: maxSegmentSeconds, minSpan: 1 };

  function pickTrack(track: AudioTrackView): void {
    if (value.trackId === track.id) {
      onChange(NO_AUDIO);
      return;
    }
    const span = Math.min(maxSegmentSeconds, track.durationSeconds);
    onChange({
      source: "LIBRARY",
      trackId: track.id,
      file: null,
      durationSeconds: track.durationSeconds,
      segment: normalizeRange(
        { start: 0, end: span },
        {
          duration: track.durationSeconds,
          maxSpan: maxSegmentSeconds,
          minSpan: 1,
        },
      ),
    });
  }

  async function pickFile(file: File | undefined): Promise<void> {
    if (file === undefined) {
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const duration = (await readAudioDuration(objectUrl)) ?? maxSegmentSeconds;
    URL.revokeObjectURL(objectUrl);
    const span = Math.min(maxSegmentSeconds, duration);
    onChange({
      source: "UPLOAD",
      trackId: null,
      file,
      durationSeconds: duration,
      segment: normalizeRange(
        { start: 0, end: span },
        {
          duration,
          maxSpan: maxSegmentSeconds,
          minSpan: 1,
        },
      ),
    });
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {libraryEnabled ? (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {moods.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMood(option)}
                disabled={disabled}
                aria-pressed={mood === option}
                style={{
                  minHeight: 32,
                  padding: "0 12px",
                  fontSize: 13,
                  borderRadius: 999,
                  cursor: "pointer",
                  border: `1px solid ${mood === option ? cssVar("primary") : cssVar("border")}`,
                  background: mood === option ? cssVar("primary") : cssVar("surface"),
                  color: mood === option ? cssVar("textOnPrimary") : cssVar("mutedText"),
                }}
              >
                {option}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: cssVar("mutedText") }}>
              No HASUT tracks in this mood yet. You can still add your own audio.
            </p>
          ) : (
            <ul
              aria-label="HASUT cloud audio"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: 4,
                maxHeight: 200,
                overflowY: "auto",
              }}
            >
              {visible.map((track) => {
                const selected = value.source === "LIBRARY" && value.trackId === track.id;
                return (
                  <li key={track.id}>
                    <button
                      type="button"
                      onClick={() => pickTrack(track)}
                      disabled={disabled}
                      aria-pressed={selected}
                      style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        textAlign: "left",
                        cursor: "pointer",
                        borderRadius: cssVar("radius"),
                        border: `1px solid ${selected ? cssVar("primary") : cssVar("border")}`,
                        background: selected ? cssVar("background") : cssVar("surface"),
                        color: cssVar("text"),
                      }}
                    >
                      <span style={{ display: "grid" }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{track.title}</span>
                        <span style={{ fontSize: 13, color: cssVar("mutedText") }}>
                          {track.artist} · {track.mood}
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          color: cssVar("mutedText"),
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatClock(track.durationSeconds)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: cssVar("mutedText") }}>
          The HASUT audio library is switched off. You can still add your own audio.
        </p>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          style={{
            minHeight: 36,
            padding: "0 14px",
            borderRadius: cssVar("buttonRadius"),
            border: `1px solid ${cssVar("border")}`,
            background: cssVar("background"),
            color: cssVar("text"),
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {value.source === "UPLOAD" ? "Replace my audio" : "Use my own audio"}
        </button>
        {value.source === "NONE" ? null : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(NO_AUDIO)}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              color: cssVar("primary"),
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Remove audio
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="audio/mpeg,audio/mp4,audio/aac,audio/wav"
          aria-label="Your own audio file"
          disabled={disabled}
          onChange={(event) => void pickFile(event.target.files?.[0])}
          style={{ display: "none" }}
        />
      </div>

      {value.source === "NONE" ? null : (
        <RangeSelect
          label="Audio portion"
          value={value.segment}
          bounds={bounds}
          disabled={disabled}
          onChange={(segment) => onChange({ ...value, segment })}
          hint={`Playing ${formatClock(value.segment.end - value.segment.start)} of this track`}
        />
      )}
    </div>
  );
}
