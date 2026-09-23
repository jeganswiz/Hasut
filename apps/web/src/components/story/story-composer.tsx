"use client";

import type {
  AudioTrackView,
  StoryAudience,
  StoryComposerConfig,
  StoryOriginalAudioMode,
  StoryView,
} from "@hasut/types";
import {
  Button,
  ColorSwatches,
  RangeSelect,
  SegmentedTabs,
  cssVar,
  formatClock,
  normalizeRange,
  type RangeValue,
} from "@hasut/ui";
import { useEffect, useState } from "react";
import { createWebApiClient } from "../../lib/api";
import { IDLE, failure, loading, success, type AuthFeedback } from "../../lib/auth-flow";
import { AuthFeedbackNote } from "../auth/auth-feedback";
import { AudiencePicker } from "./audience-picker";
import { AudioPicker, NO_AUDIO, type AudioChoice } from "./audio-picker";
import { MediaPicker, type PickedMedia } from "./media-picker";

type Kind = "IMAGE" | "VIDEO";

const ORIGINAL_AUDIO_LABELS: Record<StoryOriginalAudioMode, string> = {
  KEEP: "Keep original sound",
  MUTE: "Mute original sound",
  OVERLAY: "Layer over original",
};

async function upload(
  file: File,
  purpose: "STORY_IMAGE" | "STORY_VIDEO" | "STORY_AUDIO",
): Promise<string> {
  const client = createWebApiClient();
  const presign = await client.presignMedia({
    purpose,
    mimeType: file.type.length > 0 ? file.type : "application/octet-stream",
    byteSize: file.size,
  });
  await fetch(presign.uploadUrl, { method: "PUT", headers: presign.headers, body: file });
  await client.completeMedia({ mediaId: presign.mediaId });
  return presign.mediaId;
}

export interface StoryComposerProps {
  config: StoryComposerConfig;
  tracks: AudioTrackView[];
  onPublished: (story: StoryView) => void;
}

export function StoryComposer({ config, tracks, onPublished }: StoryComposerProps) {
  const [kind, setKind] = useState<Kind>("IMAGE");
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [caption, setCaption] = useState("");
  const [captionColor, setCaptionColor] = useState<string | null>(null);
  const [audio, setAudio] = useState<AudioChoice>(NO_AUDIO);
  const [originalAudio, setOriginalAudio] = useState<StoryOriginalAudioMode>("KEEP");
  const [audience, setAudience] = useState<StoryAudience>("EVERYONE");
  const [trim, setTrim] = useState<RangeValue>({ start: 0, end: 0 });
  const [feedback, setFeedback] = useState<AuthFeedback>(IDLE);

  const busy = feedback.status === "loading";
  const videoDuration = media?.durationSeconds ?? null;
  const trimBounds = {
    duration: videoDuration ?? config.maxVideoDurationSeconds,
    maxSpan: config.maxVideoDurationSeconds,
    minSpan: 1,
  };

  // A newly decoded clip decides the trim window; keep it inside the cap.
  useEffect(() => {
    if (kind !== "VIDEO" || videoDuration === null) {
      return;
    }
    setTrim(
      normalizeRange(
        { start: 0, end: Math.min(videoDuration, config.maxVideoDurationSeconds) },
        { duration: videoDuration, maxSpan: config.maxVideoDurationSeconds, minSpan: 1 },
      ),
    );
  }, [kind, videoDuration, config.maxVideoDurationSeconds]);

  function switchKind(next: Kind): void {
    setKind(next);
    setMedia(null);
    setTrim({ start: 0, end: 0 });
    // A still image has no original track to keep, mute, or layer under.
    setOriginalAudio("KEEP");
    setFeedback(IDLE);
  }

  function chooseOriginalAudio(mode: StoryOriginalAudioMode): void {
    setOriginalAudio(mode);
    setFeedback(IDLE);
  }

  async function publish(): Promise<void> {
    if (media === null) {
      setFeedback({
        status: "error",
        message: `Choose a ${kind === "IMAGE" ? "photo" : "video"} first.`,
      });
      return;
    }
    if (originalAudio === "OVERLAY" && audio.source === "NONE") {
      setFeedback({ status: "error", message: "Pick a track to layer over the original sound." });
      return;
    }

    setFeedback(loading("Uploading your story…"));
    try {
      const client = createWebApiClient();
      const mediaId = await upload(media.file, kind === "IMAGE" ? "STORY_IMAGE" : "STORY_VIDEO");
      const audioMediaId =
        audio.source === "UPLOAD" && audio.file !== null
          ? await upload(audio.file, "STORY_AUDIO")
          : null;

      setFeedback(loading("Publishing…"));
      const story = await client.createStory({
        kind,
        imageMediaId: kind === "IMAGE" ? mediaId : undefined,
        videoMediaId: kind === "VIDEO" ? mediaId : undefined,
        caption,
        captionColor,
        audience,
        originalAudioMode: kind === "IMAGE" ? "KEEP" : originalAudio,
        trimStartSeconds: kind === "VIDEO" ? trim.start : 0,
        trimEndSeconds: kind === "VIDEO" && trim.end > trim.start ? trim.end : null,
        audio:
          audio.source === "NONE"
            ? undefined
            : {
                source: audio.source,
                trackId: audio.trackId,
                mediaId: audioMediaId,
                startSeconds: audio.segment.start,
                endSeconds: audio.segment.end > audio.segment.start ? audio.segment.end : null,
              },
      });

      onPublished(story);
      setMedia(null);
      setCaption("");
      setCaptionColor(null);
      setAudio(NO_AUDIO);
      setOriginalAudio("KEEP");
      setFeedback(
        success(
          audience === "PATRONS"
            ? "Story published to your Patrons. It stays on the map for 24 hours."
            : "Story published. It stays on the map for 24 hours.",
        ),
      );
    } catch (error) {
      setFeedback(failure(error, "Unable to publish that story."));
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <SegmentedTabs
        label="Story type"
        tabs={[
          { id: "IMAGE", label: "Photo" },
          { id: "VIDEO", label: "Video" },
        ]}
        active={kind}
        onChange={switchKind}
      />

      <div
        style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 260px) minmax(0, 1fr)" }}
      >
        <div style={{ position: "relative" }}>
          <MediaPicker kind={kind} value={media} onChange={setMedia} disabled={busy} />
          {media === null || caption.trim().length === 0 ? null : (
            <p
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: 52,
                margin: 0,
                padding: "6px 10px",
                borderRadius: cssVar("radius"),
                background: "rgba(0,0,0,0.45)",
                color: captionColor ?? cssVar("textOnPrimary"),
                fontWeight: 700,
                fontSize: 15,
                textAlign: "center",
                pointerEvents: "none",
                wordBreak: "break-word",
              }}
            >
              {caption}
            </p>
          )}
        </div>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label htmlFor="story-caption" style={{ fontSize: 14, color: cssVar("mutedText") }}>
              Caption
            </label>
            <textarea
              id="story-caption"
              value={caption}
              maxLength={config.captionMaxLength}
              disabled={busy}
              rows={2}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Say what you are working on"
              style={{
                width: "100%",
                padding: 12,
                fontSize: 15,
                resize: "vertical",
                color: cssVar("text"),
                background: cssVar("surface"),
                border: `1.5px solid ${cssVar("border")}`,
                borderRadius: cssVar("radius"),
              }}
            />
            <span style={{ fontSize: 13, color: cssVar("mutedText") }}>
              {caption.length} / {config.captionMaxLength}
            </span>
            <ColorSwatches
              label="Caption colour"
              colors={config.captionColors}
              value={captionColor}
              onChange={setCaptionColor}
              disabled={busy}
            />
          </div>

          {kind === "VIDEO" ? (
            <>
              <RangeSelect
                label="Trim video"
                value={trim}
                bounds={trimBounds}
                disabled={busy || media === null}
                onChange={setTrim}
                hint={
                  media === null
                    ? "Choose a video to trim it."
                    : `Publishing ${formatClock(trim.end - trim.start)} of this clip`
                }
              />
              <fieldset
                style={{
                  margin: 0,
                  padding: 0,
                  border: "none",
                  display: "grid",
                  gap: 6,
                }}
              >
                <legend style={{ padding: 0, fontSize: 14, color: cssVar("mutedText") }}>
                  Original sound
                </legend>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(Object.keys(ORIGINAL_AUDIO_LABELS) as StoryOriginalAudioMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={busy}
                      aria-pressed={originalAudio === mode}
                      onClick={() => chooseOriginalAudio(mode)}
                      style={{
                        minHeight: 36,
                        padding: "0 12px",
                        fontSize: 13,
                        borderRadius: 999,
                        cursor: "pointer",
                        border: `1px solid ${
                          originalAudio === mode ? cssVar("primary") : cssVar("border")
                        }`,
                        background: originalAudio === mode ? cssVar("primary") : cssVar("surface"),
                        color:
                          originalAudio === mode ? cssVar("textOnPrimary") : cssVar("mutedText"),
                      }}
                    >
                      {ORIGINAL_AUDIO_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          ) : null}

          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 14, color: cssVar("mutedText") }}>Soundtrack</span>
            <AudioPicker
              tracks={tracks}
              libraryEnabled={config.audioLibraryEnabled}
              maxSegmentSeconds={config.maxAudioSegmentSeconds}
              value={audio}
              onChange={setAudio}
              disabled={busy}
            />
          </div>

          <AudiencePicker
            value={audience}
            onChange={setAudience}
            patronCount={config.patronCount}
            disabled={busy}
          />
          <p style={{ margin: 0, fontSize: 13, color: cssVar("mutedText") }}>
            Up to {config.maxActiveStories} active stories, each for {config.storyTtlHours} hours.
          </p>

          <AuthFeedbackNote feedback={feedback} />
          <Button onClick={() => void publish()} disabled={busy}>
            {busy ? "Publishing…" : "Publish story"}
          </Button>
        </div>
      </div>
    </div>
  );
}
