"use client";

import { cssVar } from "@hasut/ui";
import { useEffect, useState } from "react";

const BARS = 48;

/**
 * Draws peaks from a soundtrack the member can already preview.
 * A file the browser cannot decode leaves the row empty rather than a fake shape.
 */
export function AudioWaveform({ source }: { source: string | File | null }) {
  const [peaks, setPeaks] = useState<number[] | null>(null);

  useEffect(() => {
    if (source === null) {
      setPeaks(null);
      return;
    }
    let cancelled = false;
    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    const owned = typeof source !== "string";
    void (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          return;
        }
        const bytes = await response.arrayBuffer();
        const context = new AudioContext();
        try {
          const audio = await context.decodeAudioData(bytes.slice(0));
          if (!cancelled) {
            setPeaks(samplePeaks(audio.getChannelData(0), BARS));
          }
        } finally {
          void context.close();
        }
      } catch {
        if (!cancelled) {
          setPeaks(null);
        }
      } finally {
        if (owned) {
          URL.revokeObjectURL(url);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (source === null || peaks === null) {
    return null;
  }

  return (
    <div aria-hidden style={{ display: "flex", alignItems: "center", gap: 2, height: 36 }}>
      {peaks.map((peak, index) => (
        <span
          key={index}
          style={{
            flex: 1,
            height: `${Math.max(8, peak * 100)}%`,
            borderRadius: 999,
            background: cssVar("primary"),
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

function samplePeaks(channel: Float32Array, bars: number): number[] {
  const block = Math.max(1, Math.floor(channel.length / bars));
  const peaks: number[] = [];
  for (let index = 0; index < bars; index += 1) {
    let peak = 0;
    const start = index * block;
    for (let offset = 0; offset < block; offset += 24) {
      peak = Math.max(peak, Math.abs(channel[start + offset] ?? 0));
    }
    peaks.push(peak);
  }
  return peaks;
}
