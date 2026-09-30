"use client";

import { cssVar, formatClock } from "@hasut/ui";
import { useEffect, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { PhotoAdjust } from "../../lib/photo-adjust";
import { isFullCrop, objectPosition, photoCssFilter } from "../../lib/photo-adjust";
import type { PickedMedia } from "./media-picker";

export interface FrameBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DEFAULT_CAPTION_BOX: FrameBox = { x: 8, y: 64, w: 84, h: 18 };

export interface CaptionLook {
  styleIndex: number;
  backdrop: "none" | "solid" | "gradient";
  opacity: number;
}

const CAPTION_STYLES: Array<{
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fontFamily: string;
}> = [
  { fontWeight: 800, fontStyle: "normal", fontFamily: "Georgia, 'Times New Roman', serif" },
  { fontWeight: 500, fontStyle: "normal", fontFamily: "inherit" },
  { fontWeight: 600, fontStyle: "italic", fontFamily: "Georgia, 'Times New Roman', serif" },
  { fontWeight: 400, fontStyle: "normal", fontFamily: "inherit" },
];

export function StoryStage({
  kind,
  media,
  adjust,
  caption,
  captionColor,
  captionLook,
  captionMaxLength,
  onCaption,
  onCaptionDismiss,
  showCaption,
  captionBox,
  onCaptionBox,
  cropping,
  onCropStart,
  onCrop,
  onCropEnd,
  place,
  chips,
  expanded,
  onToggleExpanded,
  onClose,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  videoRef,
  originalVolume,
  trimStart,
  trimEnd,
  disabled,
}: {
  kind: "IMAGE" | "VIDEO";
  media: PickedMedia;
  adjust: PhotoAdjust;
  caption: string;
  captionColor: string | null;
  captionLook: CaptionLook;
  captionMaxLength: number;
  onCaption: (next: string) => void;
  onCaptionDismiss: () => void;
  showCaption: boolean;
  captionBox: FrameBox;
  onCaptionBox: (next: FrameBox) => void;
  cropping: boolean;
  onCropStart: () => void;
  onCrop: (next: PhotoAdjust) => void;
  onCropEnd: () => void;
  place: string | null;
  chips: readonly string[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  originalVolume: number;
  trimStart: number;
  trimEnd: number;
  disabled: boolean;
}) {
  useEffect(() => {
    const video = videoRef.current;
    if (video !== null) {
      video.volume = originalVolume;
    }
  }, [originalVolume, videoRef, media.objectUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null || kind !== "VIDEO") {
      return;
    }
    const onTime = (): void => {
      if (video.currentTime < trimStart || (trimEnd > trimStart && video.currentTime >= trimEnd)) {
        video.currentTime = trimStart;
      }
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [kind, trimStart, trimEnd, videoRef, media.objectUrl]);

  const look = CAPTION_STYLES[captionLook.styleIndex] ?? CAPTION_STYLES[0];
  const ink = captionColor ?? cssVar("textOnPrimary");
  const zoomed = kind === "IMAGE" && !cropping && !isFullCrop(adjust);
  const photoStyle = {
    position: "absolute" as const,
    width: zoomed ? `${10000 / adjust.cropW}%` : "100%",
    height: zoomed ? `${10000 / adjust.cropH}%` : "100%",
    left: zoomed ? `${(-adjust.cropX * 100) / adjust.cropW}%` : "0",
    top: zoomed ? `${(-adjust.cropY * 100) / adjust.cropH}%` : "0",
    objectFit: adjust.fit,
    objectPosition: objectPosition(adjust.panX, adjust.panY),
    transform: `rotate(${adjust.rotation}deg)`,
    filter: photoCssFilter(adjust),
  };

  return (
    <div
      className={expanded ? "story-frame is-expanded" : "story-frame"}
      style={
        kind === "IMAGE" && adjust.background === "solid"
          ? { background: cssVar("primary") }
          : kind === "IMAGE" && adjust.background === "gradient"
            ? { background: `linear-gradient(${cssVar("primary")}, ${cssVar("secondary")})` }
            : undefined
      }
    >
      {adjust.blur > 0 && kind === "IMAGE" ? (
        <img
          src={media.objectUrl}
          alt=""
          style={{
            ...photoStyle,
            position: "absolute",
            inset: 0,
            objectFit: "cover",
            filter: `blur(${adjust.blur}px) ${photoCssFilter(adjust)}`,
            transform: `rotate(${adjust.rotation}deg) scale(1.08)`,
          }}
        />
      ) : null}
      {kind === "IMAGE" ? (
        <img src={media.objectUrl} alt="Story preview" style={photoStyle} />
      ) : (
        <video
          ref={videoRef}
          key={media.objectUrl}
          src={media.objectUrl}
          controls
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            background: cssVar("text"),
          }}
        />
      )}
      {cropping ? (
        <div
          className="ps-crop"
          style={{
            left: `${adjust.cropX}%`,
            top: `${adjust.cropY}%`,
            width: `${adjust.cropW}%`,
            height: `${adjust.cropH}%`,
          }}
        >
          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <button
              key={corner}
              type="button"
              className={`ps-handle ps-handle-${corner}`}
              aria-label="Resize crop"
              onPointerDown={(event) =>
                dragCrop(event, corner, adjust, onCropStart, onCrop, onCropEnd)
              }
            />
          ))}
        </div>
      ) : null}
      {kind === "VIDEO" && media.durationSeconds !== null && media.durationSeconds > 0 ? (
        <span className="ps-ratio">{formatClock(media.durationSeconds)}</span>
      ) : null}
      <button type="button" className="ps-expand" aria-label="Preview" onClick={onToggleExpanded}>
        <ExpandIcon />
      </button>
      <div className="ps-mobile-bar">
        <button type="button" className="ps-round" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
        <span className="ps-mobile-spacer" />
        <button
          type="button"
          className="ps-round"
          aria-label="Undo"
          disabled={!canUndo || disabled}
          onClick={onUndo}
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className="ps-round"
          aria-label="Redo"
          disabled={!canRedo || disabled}
          onClick={onRedo}
        >
          <RedoIcon />
        </button>
        <button type="button" className="ps-preview-pill" onClick={onToggleExpanded}>
          Preview
        </button>
      </div>
      {showCaption ? (
        <div
          className="ps-caption-box"
          style={{
            left: `${captionBox.x}%`,
            top: `${captionBox.y}%`,
            width: `${captionBox.w}%`,
            height: `${captionBox.h}%`,
          }}
        >
          <textarea
            className="story-caption-input ps-caption"
            value={caption}
            maxLength={captionMaxLength}
            placeholder="Say what you are working on"
            aria-label="Caption on the story"
            disabled={disabled}
            onChange={(event) => onCaption(event.target.value)}
            onBlur={() => {
              if (caption.trim().length === 0) {
                onCaptionDismiss();
              }
            }}
            style={{
              color: ink,
              fontWeight: look?.fontWeight,
              fontStyle: look?.fontStyle,
              fontFamily: look?.fontFamily,
              background:
                captionLook.backdrop === "none"
                  ? "transparent"
                  : captionLook.backdrop === "solid"
                    ? `color-mix(in srgb, var(--hasut-color-text) ${captionLook.opacity}%, transparent)`
                    : `linear-gradient(90deg, color-mix(in srgb, var(--hasut-color-primary) ${captionLook.opacity}%, transparent), color-mix(in srgb, var(--hasut-color-secondary) ${captionLook.opacity}%, transparent))`,
            }}
          />
          <button
            type="button"
            className="ps-caption-move"
            aria-label="Move caption"
            onPointerDown={(event) => dragCaption(event, captionBox, onCaptionBox, false)}
          />
          <button
            type="button"
            className="ps-handle ps-handle-se"
            aria-label="Resize caption"
            onPointerDown={(event) => dragCaption(event, captionBox, onCaptionBox, true)}
          />
        </div>
      ) : null}
      <div className="ps-copy">
        {chips.length === 0 ? null : (
          <div className="ps-chips">
            {chips.map((chip) => (
              <span key={chip} className="ps-loc">
                {chip}
              </span>
            ))}
          </div>
        )}
        {place === null ? null : (
          <span className="ps-loc">
            <PinIcon />
            {place}
          </span>
        )}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function trackFrame(
  event: ReactPointerEvent<HTMLElement>,
  onMove: (dx: number, dy: number) => void,
  onEnd: () => void,
): void {
  event.preventDefault();
  event.stopPropagation();
  const frame = event.currentTarget.closest(".story-frame");
  if (frame === null) {
    return;
  }
  const rect = frame.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const move = (ev: PointerEvent): void => {
    onMove(((ev.clientX - startX) / rect.width) * 100, ((ev.clientY - startY) / rect.height) * 100);
  };
  const end = (): void => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    onEnd();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
}

function dragCaption(
  event: ReactPointerEvent<HTMLElement>,
  box: FrameBox,
  onChange: (next: FrameBox) => void,
  resize: boolean,
): void {
  trackFrame(
    event,
    (dx, dy) => {
      if (resize) {
        onChange({
          ...box,
          w: clamp(box.w + dx, 28, 100 - box.x),
          h: clamp(box.h + dy, 8, 100 - box.y),
        });
        return;
      }
      onChange({
        ...box,
        x: clamp(box.x + dx, 0, 100 - box.w),
        y: clamp(box.y + dy, 0, 100 - box.h),
      });
    },
    () => undefined,
  );
}

function dragCrop(
  event: ReactPointerEvent<HTMLElement>,
  corner: "nw" | "ne" | "sw" | "se",
  adjust: PhotoAdjust,
  onStart: () => void,
  onChange: (next: PhotoAdjust) => void,
  onEnd: () => void,
): void {
  onStart();
  const start = {
    x: adjust.cropX,
    y: adjust.cropY,
    w: adjust.cropW,
    h: adjust.cropH,
  };
  trackFrame(
    event,
    (dx, dy) => {
      let x = start.x;
      let y = start.y;
      let w = start.w;
      let h = start.h;
      if (corner === "nw" || corner === "sw") {
        x = clamp(start.x + dx, 0, start.x + start.w - 20);
        w = start.w - (x - start.x);
      } else {
        w = clamp(start.w + dx, 20, 100 - start.x);
      }
      if (corner === "nw" || corner === "ne") {
        y = clamp(start.y + dy, 0, start.y + start.h - 20);
        h = start.h - (y - start.y);
      } else {
        h = clamp(start.h + dy, 20, 100 - start.y);
      }
      onChange({ ...adjust, cropX: x, cropY: y, cropW: w, cropH: h });
    },
    onEnd,
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M8 4H4v4M16 4h4v4M4 16v4h4M20 16v4h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M8 8H4v4M4.5 12a8 8 0 1 0 2-5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M16 8h4v4M19.5 12a8 8 0 1 1-2-5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
      <path
        d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10" r="2.2" fill="currentColor" />
    </svg>
  );
}
