"use client";

import { cssVar } from "@hasut/ui";
import { useEffect, useId, useRef, useState } from "react";

export interface PickedMedia {
  file: File;
  objectUrl: string;
  /** Read from the decoded video; `null` for images. */
  durationSeconds: number | null;
}

export interface MediaPickerProps {
  kind: "IMAGE" | "VIDEO";
  value: PickedMedia | null;
  onChange: (next: PickedMedia | null) => void;
  disabled?: boolean;
}

const ACCEPT: Record<MediaPickerProps["kind"], string> = {
  IMAGE: "image/jpeg,image/png,image/webp",
  VIDEO: "video/mp4,video/webm,video/quicktime",
};

/** Reads the duration a browser reports for a video before it is uploaded. */
function readDuration(objectUrl: string): Promise<number | null> {
  return new Promise((resolve) => {
    const probe = document.createElement("video");
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

export function MediaPicker({ kind, value, onChange, disabled = false }: MediaPickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  // Object URLs are a leak if the picked file changes without revoking them.
  useEffect(() => {
    const url = value?.objectUrl;
    return () => {
      if (url !== undefined) {
        URL.revokeObjectURL(url);
      }
    };
  }, [value?.objectUrl]);

  async function accept(file: File | undefined): Promise<void> {
    if (file === undefined) {
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const durationSeconds = kind === "VIDEO" ? await readDuration(objectUrl) : null;
    onChange({ file, objectUrl, durationSeconds });
  }

  if (value !== null) {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <div
          style={{
            position: "relative",
            aspectRatio: "9 / 16",
            maxHeight: 420,
            borderRadius: cssVar("cardRadius"),
            overflow: "hidden",
            background: cssVar("text"),
            display: "grid",
            placeItems: "center",
          }}
        >
          {kind === "IMAGE" ? (
            // A blob URL for a file that never left the browser; next/image
            // cannot optimise it and would need a remote pattern it has no host for.
            <img
              src={value.objectUrl}
              alt="Story preview"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <video
              src={value.objectUrl}
              controls
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          style={{
            justifySelf: "start",
            background: "transparent",
            border: "none",
            padding: 0,
            color: cssVar("primary"),
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Choose a different {kind === "IMAGE" ? "photo" : "video"}
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void accept(event.dataTransfer.files[0]);
      }}
      style={{
        aspectRatio: "9 / 16",
        maxHeight: 420,
        display: "grid",
        placeItems: "center",
        gap: 8,
        padding: 16,
        textAlign: "center",
        borderRadius: cssVar("cardRadius"),
        border: `2px dashed ${dragging ? cssVar("primary") : cssVar("border")}`,
        background: dragging ? cssVar("background") : cssVar("surface"),
        transition: "border-color 140ms ease, background 140ms ease",
      }}
    >
      <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
        <p style={{ margin: 0, color: cssVar("mutedText"), fontSize: 14 }}>
          Drag a {kind === "IMAGE" ? "photo" : "video"} here, or
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          style={{
            minHeight: 40,
            padding: "0 16px",
            borderRadius: cssVar("buttonRadius"),
            border: `1px solid ${cssVar("border")}`,
            background: cssVar("background"),
            color: cssVar("text"),
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Browse files
        </button>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={ACCEPT[kind]}
          disabled={disabled}
          aria-label={kind === "IMAGE" ? "Story photo" : "Story video"}
          onChange={(event) => void accept(event.target.files?.[0])}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}
