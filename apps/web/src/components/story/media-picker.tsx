"use client";

import { cssVar } from "@hasut/ui";
import { useId, useRef, useState, type RefObject } from "react";
import {
  mediaKind,
  prepareStoryImage,
  prepareStoryVideo,
  STORY_IMAGE_ACCEPT,
  STORY_VIDEO_ACCEPT,
} from "../../lib/story-media";

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
  /** Drop zone only. The studio frame renders the chosen file. */
  chrome?: "full" | "drop";
  inputRef?: RefObject<HTMLInputElement | null>;
  /** One picker for both photos and videos. The caller decides the kind from the file. */
  acceptBoth?: boolean;
  onError?: (message: string) => void;
}

const ACCEPT: Record<MediaPickerProps["kind"], string> = {
  IMAGE: STORY_IMAGE_ACCEPT,
  VIDEO: STORY_VIDEO_ACCEPT,
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

export function MediaPicker({
  kind,
  value,
  onChange,
  disabled = false,
  chrome = "full",
  inputRef: inputRefProp,
  acceptBoth = false,
  onError,
}: MediaPickerProps) {
  const inputId = useId();
  const localInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = inputRefProp ?? localInputRef;
  const [dragging, setDragging] = useState(false);
  const [preparing, setPreparing] = useState(false);

  async function accept(file: File | undefined): Promise<void> {
    if (file === undefined) {
      return;
    }
    const pickedKind = mediaKind(file);
    if (pickedKind === null) {
      onError?.("Choose a photo or a video.");
      return;
    }
    setPreparing(true);
    try {
      const ready =
        pickedKind === "IMAGE" ? await prepareStoryImage(file) : prepareStoryVideo(file);
      const objectUrl = URL.createObjectURL(ready);
      const durationSeconds = pickedKind === "VIDEO" ? await readDuration(objectUrl) : null;
      onChange({ file: ready, objectUrl, durationSeconds });
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Could not open that photo.");
    } finally {
      setPreparing(false);
    }
  }

  if (value !== null && chrome === "drop") {
    return (
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={acceptBoth ? `${ACCEPT.IMAGE},${ACCEPT.VIDEO}` : ACCEPT[kind]}
        disabled={disabled}
        aria-label={kind === "IMAGE" ? "Story photo" : "Story video"}
        onChange={(event) => {
          void accept(event.target.files?.[0]);
          event.target.value = "";
        }}
        className="ps-hidden-file"
      />
    );
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
        aspectRatio: chrome === "drop" ? "auto" : "9 / 16",
        maxHeight: chrome === "drop" ? "none" : 420,
        height: chrome === "drop" ? "100%" : undefined,
        display: "grid",
        placeItems: "center",
        gap: 8,
        padding: 16,
        textAlign: "center",
        borderRadius: chrome === "drop" ? 0 : cssVar("cardRadius"),
        border:
          chrome === "drop"
            ? "none"
            : `2px dashed ${dragging ? cssVar("primary") : cssVar("border")}`,
        background: dragging
          ? cssVar("background")
          : chrome === "drop"
            ? "transparent"
            : cssVar("surface"),
        transition: "border-color 140ms ease, background 140ms ease",
      }}
    >
      <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
        <p style={{ margin: 0, color: cssVar("text"), fontWeight: 700, fontSize: 16 }}>
          Drop your photo or video here
        </p>
        <p style={{ margin: 0, color: cssVar("mutedText"), fontSize: 13 }}>
          {preparing
            ? "Opening photo…"
            : kind === "IMAGE"
              ? "Any photo, including iPhone HEIC"
              : "MP4, MOV, or WebM. Longer clips can be trimmed."}
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
          accept={acceptBoth ? `${ACCEPT.IMAGE},${ACCEPT.VIDEO}` : ACCEPT[kind]}
          disabled={disabled}
          aria-label={kind === "IMAGE" ? "Story photo" : "Story video"}
          onChange={(event) => {
            void accept(event.target.files?.[0]);
            event.target.value = "";
          }}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}
