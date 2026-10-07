"use client";

import type { AudioTrackView, StoryAudioSource } from "@hasut/types";
import { cssVar, formatClock, normalizeRange, type RangeValue } from "@hasut/ui";
import { reachablePlaybackUrl } from "@hasut/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { prepareStoryAudio } from "../../lib/story-media";
import { TrimScrubber } from "./trim-scrubber";

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
  /** 0–1 mix for the in-studio preview. Publishing still uses keep, mute, or layer. */
  previewVolume?: number;
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
  previewVolume = 1,
}: AudioPickerProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const segmentRef = useRef(value.segment);
  segmentRef.current = value.segment;
  const [mood, setMood] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);

  const moods = useMemo(() => {
    const unique = new Set(tracks.map((track) => track.mood));
    return ["All", ...[...unique].sort((a, b) => a.localeCompare(b))];
  }, [tracks]);

  useEffect(() => {
    if (previewRef.current !== null) {
      previewRef.current.volume = previewVolume;
    }
  }, [previewVolume]);

  useEffect(() => {
    if (value.source === "UPLOAD" || uploadUrl === null) {
      return;
    }
    URL.revokeObjectURL(uploadUrl);
    setUploadUrl(null);
  }, [value.source, uploadUrl]);

  useEffect(() => {
    return () => {
      if (uploadUrl !== null) {
        URL.revokeObjectURL(uploadUrl);
      }
    };
  }, [uploadUrl]);

  const visible = tracks.filter((track) => {
    const moodMatches = mood === "All" || track.mood === mood;
    const needle = query.trim().toLowerCase();
    const text = `${track.title} ${track.artist} ${track.mood}`.toLowerCase();
    return moodMatches && (needle.length === 0 || text.includes(needle));
  });
  const selectedLibrary =
    value.source === "LIBRARY" ? tracks.find((track) => track.id === value.trackId) : undefined;
  const previewSrc =
    value.source === "UPLOAD"
      ? uploadUrl
      : selectedLibrary !== undefined && reachablePlaybackUrl(selectedLibrary.audioUrl)
        ? selectedLibrary.audioUrl
        : null;

  useEffect(() => {
    const audio = previewRef.current;
    if (audio === null) {
      return;
    }
    const onTime = (): void => {
      const segment = segmentRef.current;
      if (segment.end > segment.start && audio.currentTime >= segment.end) {
        audio.currentTime = segment.start;
      }
    };
    audio.addEventListener("timeupdate", onTime);
    return () => audio.removeEventListener("timeupdate", onTime);
  }, [previewSrc]);

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
    const ready = prepareStoryAudio(file);
    const objectUrl = URL.createObjectURL(ready);
    const duration = (await readAudioDuration(objectUrl)) ?? maxSegmentSeconds;
    setUploadUrl((current) => {
      if (current !== null) {
        URL.revokeObjectURL(current);
      }
      return objectUrl;
    });
    const span = Math.min(maxSegmentSeconds, duration);
    onChange({
      source: "UPLOAD",
      trackId: null,
      file: ready,
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
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>HASUT Music</p>
      <input
        className="ps-input"
        value={query}
        disabled={disabled || !libraryEnabled}
        placeholder="Search songs, moods or artists..."
        aria-label="Search songs, moods or artists"
        onChange={(event) => setQuery(event.target.value)}
      />
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

          {tracks.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: cssVar("mutedText") }}>
              No playable HASUT tracks yet. You can still add your own audio.
            </p>
          ) : visible.length === 0 ? (
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
                        {selected ? "  ✓" : ""}
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

      <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>My audio</p>
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
          accept="audio/*,.mp3,.m4a,.aac,.wav"
          aria-label="Your own audio file"
          disabled={disabled}
          onChange={(event) => void pickFile(event.target.files?.[0])}
          style={{ display: "none" }}
        />
      </div>

      {previewSrc === null ? null : (
        <audio
          ref={previewRef}
          src={previewSrc}
          preload="auto"
          controls
          aria-label="Soundtrack preview"
          onLoadedMetadata={(event) => {
            event.currentTarget.currentTime = segmentRef.current.start;
          }}
        />
      )}

      {value.source === "NONE" || value.durationSeconds <= 0 ? null : (
        <div className="ps-trim">
          <div className="ps-trim-label">
            <span>
              Audio portion · {formatClock(value.segment.end - value.segment.start)} selected
            </span>
          </div>
          <TrimScrubber
            duration={value.durationSeconds}
            value={value.segment}
            maxSpan={maxSegmentSeconds}
            disabled={disabled}
            onChange={(segment) => {
              segmentRef.current = segment;
              onChange({ ...value, segment });
            }}
            onScrub={scrub}
          />
          <div className="ps-trim-times">
            <span>{formatClock(value.segment.start)}</span>
            <span>{formatClock(value.segment.end)}</span>
          </div>
        </div>
      )}
    </div>
  );

  function scrub(seconds: number): void {
    const audio = previewRef.current;
    if (audio === null) {
      return;
    }
    const playAt = (): void => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : seconds;
      audio.currentTime = Math.min(Math.max(0, seconds), Math.max(0, duration));
      void audio.play().catch(() => undefined);
    };
    if (audio.readyState >= 1) {
      playAt();
      return;
    }
    audio.addEventListener("loadedmetadata", playAt, { once: true });
  }
}
