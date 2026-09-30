"use client";

import {
  STORY_TTL_HOUR_OPTIONS,
  type AudioTrackView,
  type StoryAudience,
  type StoryComposerConfig,
  type StoryOriginalAudioMode,
  type StoryView,
} from "@hasut/types";
import { reachablePlaybackUrl } from "@hasut/utils";
import { Button, ColorSwatches, normalizeRange, type RangeValue } from "@hasut/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createWebApiClient } from "../../lib/api";
import { IDLE, failure, loading, success, type AuthFeedback } from "../../lib/auth-flow";
import {
  DEFAULT_PHOTO_ADJUST,
  isPlainPhoto,
  nextRotation,
  renderAdjustedPhoto,
  type PhotoAdjust,
} from "../../lib/photo-adjust";
import { AuthFeedbackNote } from "../auth/auth-feedback";
import { AudiencePicker } from "./audience-picker";
import { AudioPicker, NO_AUDIO, type AudioChoice } from "./audio-picker";
import { AudioWaveform } from "./audio-waveform";
import { MediaPicker, type PickedMedia } from "./media-picker";
import { DEFAULT_CAPTION_BOX, StoryStage, type CaptionLook, type FrameBox } from "./story-stage";
import { VideoFilmstrip } from "./video-filmstrip";

type Kind = "IMAGE" | "VIDEO";
type StudioPanel = "edit" | "text" | "sound" | "audience";
type StudioTool = "crop" | "brightness" | "contrast" | "blur" | "more";

const CAPTION_STYLE_LABELS = ["Bold", "Regular", "Italic", "Light"];

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
  await client.uploadPresigned(presign.uploadUrl, file, presign.headers);
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
  const [captionArmed, setCaptionArmed] = useState(false);
  const [captionBox, setCaptionBox] = useState<FrameBox>(DEFAULT_CAPTION_BOX);
  const durationChoices = STORY_TTL_HOUR_OPTIONS.filter((hours) => hours <= config.storyTtlHours);
  const durationOptions = durationChoices.length > 0 ? durationChoices : [config.storyTtlHours];
  const [ttlHours, setTtlHours] = useState<number>(
    durationOptions[durationOptions.length - 1] ?? config.storyTtlHours,
  );
  const [captionColor, setCaptionColor] = useState<string | null>(null);
  const [audio, setAudio] = useState<AudioChoice>(NO_AUDIO);
  const [originalAudio, setOriginalAudio] = useState<StoryOriginalAudioMode>("KEEP");
  const [audience, setAudience] = useState<StoryAudience>("EVERYONE");
  const [trim, setTrim] = useState<RangeValue>({ start: 0, end: 0 });
  const [feedback, setFeedback] = useState<AuthFeedback>(IDLE);
  const [panel, setPanel] = useState<StudioPanel>("edit");
  const [tool, setTool] = useState<StudioTool | null>(null);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [adjust, setAdjust] = useState<PhotoAdjust>(DEFAULT_PHOTO_ADJUST);
  const [past, setPast] = useState<PhotoAdjust[]>([]);
  const [future, setFuture] = useState<PhotoAdjust[]>([]);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [activityLabel, setActivityLabel] = useState<string | null>(null);
  const [showPlace, setShowPlace] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [sticker, setSticker] = useState<string | null>(null);
  const [captionLook, setCaptionLook] = useState<CaptionLook>({
    styleIndex: 0,
    backdrop: "none",
    opacity: 60,
  });
  const [meta, setMeta] = useState<{ width: number; height: number } | null>(null);
  const [originalLevel, setOriginalLevel] = useState(1);
  const [soundtrackLevel, setSoundtrackLevel] = useState(1);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRef = useRef<PickedMedia | null>(null);
  mediaRef.current = media;
  const sliderOrigin = useRef<PhotoAdjust | null>(null);
  const adjustRef = useRef(adjust);
  adjustRef.current = adjust;

  const busy = feedback.status === "loading";
  const videoDuration = media?.durationSeconds ?? null;
  const trimBounds = {
    duration: videoDuration ?? config.maxVideoDurationSeconds,
    maxSpan: config.maxVideoDurationSeconds,
    minSpan: 1,
  };
  const overlays = [
    showPlace && placeLabel !== null ? placeLabel : null,
    showActivity && activityLabel !== null ? activityLabel : null,
    sticker,
  ].filter((line): line is string => line !== null);
  const waveformSource = waveformFor(audio, tracks);

  useEffect(() => {
    let cancelled = false;
    void createWebApiClient()
      .getMyProfile()
      .then((profile) => {
        if (cancelled) {
          return;
        }
        setPlaceLabel(profile.approximateLocation?.label ?? null);
        setActivityLabel(profile.currentMode?.label ?? null);
        if (profile.approximateLocation?.label) {
          setShowPlace(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    if (media === null) {
      setMeta(null);
      setPlaying(false);
      return;
    }
    if (kind === "IMAGE") {
      const image = new Image();
      image.onload = () => setMeta({ width: image.naturalWidth, height: image.naturalHeight });
      image.src = media.objectUrl;
      return;
    }
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => setMeta({ width: probe.videoWidth, height: probe.videoHeight });
    probe.src = media.objectUrl;
  }, [media, kind]);

  useEffect(() => {
    if (kind !== "VIDEO" || originalAudio === "MUTE") {
      return;
    }
    const next = audio.source === "NONE" ? "KEEP" : "OVERLAY";
    if (originalAudio !== next) {
      setOriginalAudio(next);
    }
  }, [audio.source, kind, originalAudio]);
  useEffect(() => {
    if (!expanded) {
      return;
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  useEffect(() => {
    return () => {
      const url = mediaRef.current?.objectUrl;
      if (url !== undefined) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  function chooseMedia(next: PickedMedia | null): void {
    if (next !== null) {
      const video = next.file.type.startsWith("video/");
      setKind(video ? "VIDEO" : "IMAGE");
      if (!video) {
        setOriginalAudio("KEEP");
      }
    }
    setMedia((current) => {
      if (current !== null && current.objectUrl !== next?.objectUrl) {
        URL.revokeObjectURL(current.objectUrl);
      }
      return next;
    });
    setAdjust(DEFAULT_PHOTO_ADJUST);
    setPast([]);
    setFuture([]);
    setPlaying(false);
    setFeedback(IDLE);
  }

  function togglePlay(): void {
    const video = videoRef.current;
    if (video === null) {
      return;
    }
    if (video.paused) {
      void video.play();
      setPlaying(true);
      return;
    }
    video.pause();
    setPlaying(false);
  }

  function setOriginalOn(on: boolean): void {
    setOriginalAudio(on ? (audio.source === "NONE" ? "KEEP" : "OVERLAY") : "MUTE");
    setFeedback(IDLE);
  }

  function editPhoto(next: PhotoAdjust): void {
    setPast((items) => [...items, adjust].slice(-30));
    setFuture([]);
    setAdjust(next);
  }

  function undoPhoto(): void {
    const previous = past[past.length - 1];
    if (previous === undefined) {
      return;
    }
    setFuture((ahead) => [adjust, ...ahead]);
    setPast((items) => items.slice(0, -1));
    setAdjust(previous);
  }

  function redoPhoto(): void {
    const next = future[0];
    if (next === undefined) {
      return;
    }
    setPast((behind) => [...behind, adjust]);
    setFuture((items) => items.slice(1));
    setAdjust(next);
  }

  function beginSlider(): void {
    sliderOrigin.current = adjustRef.current;
  }

  function endSlider(): void {
    const origin = sliderOrigin.current;
    sliderOrigin.current = null;
    const current = adjustRef.current;
    if (origin === null || sameAdjust(origin, current)) {
      return;
    }
    setPast((items) => [...items, origin].slice(-30));
    setFuture([]);
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
      let imageFile = media.file;
      if (kind === "IMAGE" && (!isPlainPhoto(adjust) || overlays.length > 0)) {
        const blob = await renderAdjustedPhoto(media.objectUrl, adjust, overlays);
        imageFile = new File([blob], "story.jpg", { type: "image/jpeg" });
      }
      const mediaId = await upload(imageFile, kind === "IMAGE" ? "STORY_IMAGE" : "STORY_VIDEO");
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
        ttlHours: (STORY_TTL_HOUR_OPTIONS as readonly number[]).includes(ttlHours)
          ? (ttlHours as 4 | 8 | 12 | 24)
          : undefined,
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
      chooseMedia(null);
      setCaption("");
      setCaptionColor(null);
      setAudio(NO_AUDIO);
      setOriginalAudio("KEEP");
      setAdjust(DEFAULT_PHOTO_ADJUST);
      setPast([]);
      setFuture([]);
      setShowPlace(false);
      setShowActivity(false);
      setFeedback(
        success(
          audience === "PATRONS"
            ? `Story published to your Patrons. It stays on the map for ${ttlHours} hours.`
            : `Story published. It stays on the map for ${ttlHours} hours.`,
        ),
      );
    } catch (error) {
      setFeedback(failure(error, "Unable to publish that story."));
    }
  }

  return (
    <div className="ps-grid">
      <div className="ps-stage-col">
        {media === null ? (
          <div className="story-frame is-empty">
            <MediaPicker
              kind={kind}
              value={media}
              onChange={chooseMedia}
              disabled={busy}
              chrome="drop"
              acceptBoth
              inputRef={fileRef}
            />
          </div>
        ) : (
          <StoryStage
            kind={kind}
            media={media}
            adjust={adjust}
            caption={caption}
            captionColor={captionColor}
            captionLook={captionLook}
            captionMaxLength={config.captionMaxLength}
            onCaption={setCaption}
            onCaptionDismiss={() => setCaptionArmed(false)}
            showCaption={captionArmed || caption.trim().length > 0}
            captionBox={captionBox}
            onCaptionBox={setCaptionBox}
            cropping={tool === "crop"}
            onCropStart={beginSlider}
            onCrop={setAdjust}
            onCropEnd={endSlider}
            place={showPlace ? placeLabel : null}
            chips={[showActivity && activityLabel !== null ? activityLabel : null, sticker].filter(
              (line): line is string => line !== null,
            )}
            expanded={expanded}
            onToggleExpanded={() => setExpanded((value) => !value)}
            onClose={() => {
              if (window.history.length > 1) {
                window.history.back();
                return;
              }
              window.location.assign("/");
            }}
            onUndo={undoPhoto}
            onRedo={redoPhoto}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            videoRef={videoRef}
            originalVolume={kind === "VIDEO" && originalAudio === "MUTE" ? 0 : originalLevel}
            trimStart={kind === "VIDEO" ? trim.start : 0}
            trimEnd={kind === "VIDEO" ? trim.end : 0}
            disabled={busy}
          />
        )}
        {media === null ? null : (
          <MediaPicker
            kind={kind}
            value={media}
            onChange={chooseMedia}
            disabled={busy}
            chrome="drop"
            acceptBoth
            inputRef={fileRef}
          />
        )}

        <div className="ps-mobile-tabs" role="tablist" aria-label="Story tools">
          {(
            [
              ["edit", "Edit"],
              ["text", "Text"],
              ["sound", "Sound"],
              ["audience", "Audience"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={panel === id}
              className={panel === id ? "ps-mode is-active" : "ps-mode"}
              onClick={() => {
                setPanel(id);
                if (id === "text") {
                  setCaptionArmed(true);
                  window.setTimeout(() => {
                    document.querySelector<HTMLTextAreaElement>(".ps-caption")?.focus();
                  }, 0);
                  return;
                }
                document
                  .getElementById(`ps-${id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div id="ps-edit" className="ps-toolbar">
          <ToolButton
            label="Crop"
            active={tool === "crop"}
            disabled={busy || media === null}
            onClick={() => setTool(tool === "crop" ? null : "crop")}
            icon={<CropIcon />}
          />
          <ToolButton
            label="Rotate"
            active={false}
            disabled={busy || media === null || kind !== "IMAGE"}
            onClick={() => editPhoto({ ...adjust, rotation: nextRotation(adjust.rotation) })}
            icon={<RotateIcon />}
          />
          <ToolButton
            label="Brightness"
            active={tool === "brightness"}
            disabled={busy || media === null || kind !== "IMAGE"}
            onClick={() => setTool(tool === "brightness" ? null : "brightness")}
            icon={<SunIcon />}
          />
          <ToolButton
            label="Contrast"
            active={tool === "contrast"}
            disabled={busy || media === null || kind !== "IMAGE"}
            onClick={() => setTool(tool === "contrast" ? null : "contrast")}
            icon={<ContrastIcon />}
          />
          <ToolButton
            label="Blur"
            active={tool === "blur"}
            disabled={busy || media === null || kind !== "IMAGE"}
            onClick={() => setTool(tool === "blur" ? null : "blur")}
            icon={<BlurIcon />}
          />
          <ToolButton
            label="More"
            active={tool === "more"}
            disabled={busy || media === null}
            onClick={() => setTool(tool === "more" ? null : "more")}
            icon={<MoreIcon />}
          />
        </div>
        {tool === null || media === null ? null : (
          <div className="ps-popover">
            {tool === "crop" ? (
              <div className="studio-pills">
                <button
                  type="button"
                  className={adjust.fit === "contain" ? "studio-pill is-active" : "studio-pill"}
                  onClick={() => editPhoto({ ...adjust, fit: "contain", panX: 0, panY: 0 })}
                >
                  Fit
                </button>
                <button
                  type="button"
                  className={adjust.fit === "cover" ? "studio-pill is-active" : "studio-pill"}
                  onClick={() => editPhoto({ ...adjust, fit: "cover" })}
                >
                  Fill
                </button>
              </div>
            ) : null}
            {tool === "brightness" ? (
              <Slider
                label="Brightness"
                min={40}
                max={160}
                value={adjust.brightness}
                disabled={busy}
                onStart={beginSlider}
                onEnd={endSlider}
                onChange={(brightness) => setAdjust({ ...adjust, brightness })}
              />
            ) : null}
            {tool === "contrast" ? (
              <Slider
                label="Contrast"
                min={40}
                max={160}
                value={adjust.contrast}
                disabled={busy}
                onStart={beginSlider}
                onEnd={endSlider}
                onChange={(contrast) => setAdjust({ ...adjust, contrast })}
              />
            ) : null}
            {tool === "blur" ? (
              <Slider
                label="Blur"
                min={0}
                max={24}
                value={adjust.blur}
                disabled={busy}
                onStart={beginSlider}
                onEnd={endSlider}
                onChange={(blur) => setAdjust({ ...adjust, blur })}
              />
            ) : null}
            {tool === "more" && adjust.fit === "cover" ? (
              <>
                <Slider
                  label="Horizontal position"
                  min={-100}
                  max={100}
                  value={adjust.panX}
                  disabled={busy}
                  onStart={beginSlider}
                  onEnd={endSlider}
                  onChange={(panX) => setAdjust({ ...adjust, panX })}
                />
                <Slider
                  label="Vertical position"
                  min={-100}
                  max={100}
                  value={adjust.panY}
                  disabled={busy}
                  onStart={beginSlider}
                  onEnd={endSlider}
                  onChange={(panY) => setAdjust({ ...adjust, panY })}
                />
              </>
            ) : null}
            {tool === "more" ? (
              <button
                type="button"
                className="text-button"
                onClick={() => editPhoto(DEFAULT_PHOTO_ADJUST)}
              >
                Reset edit
              </button>
            ) : null}
          </div>
        )}

        {kind === "VIDEO" && media !== null && videoDuration !== null ? (
          <VideoFilmstrip
            src={media.objectUrl}
            duration={videoDuration}
            value={trim}
            maxSpan={trimBounds.maxSpan}
            disabled={busy}
            onChange={setTrim}
            playing={playing}
            onTogglePlay={togglePlay}
          />
        ) : null}
        {kind === "VIDEO" && media !== null ? <AudioWaveform source={media.file} /> : null}
      </div>

      <div className="ps-cards">
        <section className="ps-card ps-desktop-only">
          <header className="ps-card-head">
            <h2>Media</h2>
            <span aria-hidden>▾</span>
          </header>
          {media === null ? (
            <button
              type="button"
              className="ps-add"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              + Add media
            </button>
          ) : (
            <div className="ps-file">
              {kind === "IMAGE" ? (
                <img src={media.objectUrl} alt="" />
              ) : (
                <video src={media.objectUrl} muted />
              )}
              <div>
                <strong>{media.file.name}</strong>
                <p>{describeMedia(media.file, meta)}</p>
              </div>
              <button
                type="button"
                className="ps-icon-x"
                aria-label="Remove media"
                disabled={busy}
                onClick={() => chooseMedia(null)}
              >
                ×
              </button>
            </div>
          )}
          {media === null ? null : (
            <button
              type="button"
              className="ps-add"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              + Add media
            </button>
          )}
        </section>

        <section id="ps-text" className="ps-card ps-desktop-only">
          <header className="ps-card-head">
            <h2>Caption</h2>
            <span>
              {caption.length} / {config.captionMaxLength}
            </span>
          </header>
          <input
            className="ps-input"
            value={caption}
            maxLength={config.captionMaxLength}
            placeholder="Say what you are working on"
            aria-label="Caption"
            disabled={busy}
            onFocus={() => setCaptionArmed(true)}
            onBlur={() => {
              if (caption.trim().length === 0) {
                setCaptionArmed(false);
              }
            }}
            onChange={(event) => setCaption(event.target.value)}
          />
          <p className="ps-label">Text style</p>
          <div className="ps-style-row" role="radiogroup" aria-label="Text style">
            {CAPTION_STYLE_LABELS.map((label, index) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={captionLook.styleIndex === index}
                aria-label={label}
                className={captionLook.styleIndex === index ? "ps-aa is-active" : "ps-aa"}
                onClick={() => setCaptionLook({ ...captionLook, styleIndex: index })}
              >
                Aa
              </button>
            ))}
          </div>
          <p className="ps-label">Text color</p>
          <ColorSwatches
            label="Caption colour"
            colors={config.captionColors}
            value={captionColor}
            onChange={setCaptionColor}
            disabled={busy}
          />
          <p className="ps-label">Background</p>
          <div className="studio-pills" role="radiogroup" aria-label="Background">
            {(["none", "solid", "gradient"] as const).map((backdrop) => (
              <button
                key={backdrop}
                type="button"
                role="radio"
                aria-checked={captionLook.backdrop === backdrop}
                className={
                  captionLook.backdrop === backdrop ? "studio-pill is-active" : "studio-pill"
                }
                onClick={() => setCaptionLook({ ...captionLook, backdrop })}
              >
                {backdrop === "none" ? "None" : backdrop === "solid" ? "Solid" : "Gradient"}
              </button>
            ))}
          </div>
          <div className="ps-opacity">
            <Slider
              label="Transparency"
              min={0}
              max={100}
              value={captionLook.opacity}
              disabled={busy}
              onStart={() => undefined}
              onEnd={() => undefined}
              onChange={(opacity) => setCaptionLook({ ...captionLook, opacity })}
            />
            <span>{captionLook.opacity}%</span>
            <span className="ps-checker" aria-hidden />
          </div>
        </section>

        <section className="ps-card ps-desktop-only">
          <h2>Stickers / Location</h2>
          <div className="ps-sticker-row">
            <button
              type="button"
              className="ps-outline"
              onClick={() => setSticker(sticker === null ? "Now" : null)}
            >
              + Add sticker
            </button>
            <button
              type="button"
              className="ps-outline"
              disabled={placeLabel === null}
              onClick={() => setShowPlace((value) => !value)}
            >
              + Add location
            </button>
            <button
              type="button"
              className="ps-outline"
              disabled={activityLabel === null}
              onClick={() => setShowActivity((value) => !value)}
            >
              + Tag people
            </button>
          </div>
          {sticker === null ? null : (
            <div className="studio-pills">
              {["Now", "On site", "Open"].map((mark) => (
                <button
                  key={mark}
                  type="button"
                  className={sticker === mark ? "studio-pill is-active" : "studio-pill"}
                  onClick={() => setSticker(mark)}
                >
                  {mark}
                </button>
              ))}
            </div>
          )}
        </section>

        <section id="ps-sound" className="ps-card">
          <h2>Soundtrack</h2>
          {kind === "VIDEO" ? (
            <label className="ps-toggle-row">
              <span>
                <WaveMini /> Use original sound
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={originalAudio !== "MUTE"}
                disabled={busy}
                aria-label="Use original sound"
                onChange={(event) => setOriginalOn(event.target.checked)}
              />
            </label>
          ) : null}
          {originalAudio === "OVERLAY" && audio.source === "NONE" ? (
            <p className="hint">Pick a track to layer over the original sound.</p>
          ) : null}
          <AudioPicker
            tracks={tracks}
            libraryEnabled={config.audioLibraryEnabled}
            maxSegmentSeconds={config.maxAudioSegmentSeconds}
            value={audio}
            onChange={setAudio}
            disabled={busy}
            previewVolume={soundtrackLevel}
          />
          <AudioWaveform source={waveformSource} />
          <Slider
            label="Volume"
            min={0}
            max={100}
            value={Math.round(originalLevel * 100)}
            disabled={busy}
            onStart={() => undefined}
            onEnd={() => undefined}
            onChange={(next) => {
              const level = next / 100;
              setOriginalLevel(level);
              setSoundtrackLevel(level);
            }}
          />
        </section>

        <section id="ps-audience" className="ps-card">
          <AudiencePicker
            value={audience}
            onChange={setAudience}
            patronCount={config.patronCount}
            disabled={busy}
          />
        </section>

        <section className="ps-card">
          <header className="ps-card-head">
            <h2>Story duration</h2>
            <select
              aria-label="Story duration"
              value={String(ttlHours)}
              disabled={busy}
              onChange={(event) => setTtlHours(Number(event.target.value))}
            >
              {durationOptions.map((hours) => (
                <option key={hours} value={hours}>
                  {hours} hours
                </option>
              ))}
            </select>
          </header>
          <p className="hint">
            Up to {config.maxActiveStories} active stories. This one stays on the map for {ttlHours}{" "}
            hours.
          </p>
        </section>

        <div className="ps-publish">
          <AuthFeedbackNote feedback={feedback} />
          <Button onClick={() => void publish()} disabled={busy}>
            <SendIcon /> {busy ? "Publishing…" : "Publish story"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "ps-tool is-active" : "ps-tool"}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  disabled,
  onChange,
  onStart,
  onEnd,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  disabled: boolean;
  onChange: (next: number) => void;
  onStart: () => void;
  onEnd: () => void;
}) {
  return (
    <label className="studio-slider">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={label}
        onPointerDown={onStart}
        onPointerUp={onEnd}
        onKeyUp={onEnd}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function describeMedia(file: File, meta: { width: number; height: number } | null): string {
  const type = file.type.includes("png")
    ? "PNG"
    : file.type.includes("webp")
      ? "WebP"
      : file.type.startsWith("video/")
        ? "Video"
        : "JPG";
  const size =
    file.size >= 1_048_576
      ? `${(file.size / 1_048_576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;
  const dims = meta === null ? null : `${meta.width} × ${meta.height}`;
  return [type, dims, size].filter((part) => part !== null).join(" · ");
}

function waveformFor(audio: AudioChoice, tracks: AudioTrackView[]): string | File | null {
  if (audio.source === "UPLOAD" && audio.file !== null) {
    return audio.file;
  }
  if (audio.source === "LIBRARY") {
    const url = tracks.find((track) => track.id === audio.trackId)?.audioUrl ?? null;
    return url !== null && reachablePlaybackUrl(url) ? url : null;
  }
  return null;
}

function sameAdjust(left: PhotoAdjust, right: PhotoAdjust): boolean {
  return (
    left.rotation === right.rotation &&
    left.fit === right.fit &&
    left.brightness === right.brightness &&
    left.contrast === right.contrast &&
    left.blur === right.blur &&
    left.panX === right.panX &&
    left.panY === right.panY &&
    left.background === right.background &&
    left.cropX === right.cropX &&
    left.cropY === right.cropY &&
    left.cropW === right.cropW &&
    left.cropH === right.cropH
  );
}

function CropIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M6 3v12a3 3 0 0 0 3 3h12M18 21V9a3 3 0 0 0-3-3H3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ContrastIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
    </svg>
  );
}

function BlurIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M12 3c2 3 2 5 0 8s-2 5 0 8M7 5c2 2.5 2 4.5 0 7s-2 4.5 0 7M17 5c-2 2.5-2 4.5 0 7s2 4.5 0 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <circle cx="6" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="18" cy="12" r="1.3" fill="currentColor" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M4 12l16-7-6 16-2.5-6.5L4 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WaveMini() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M3 12h2l2-5 3 10 3-8 2 3h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
