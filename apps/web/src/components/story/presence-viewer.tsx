"use client";

import type { LiveSessionView, StoryView } from "@hasut/types";
import { Button, SegmentedTabs, cssVar } from "@hasut/ui";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { isLivePlaylist, LIVE_PLAYLIST_POLL_MS } from "../../lib/live-playlist";
import { loopWithin, mutesOriginalAudio, storyAudioSrc } from "../../lib/story-playback";

type Tab = "activity" | "live";

export function PresenceViewer({
  stories,
  live,
}: {
  stories: StoryView[];
  live: LiveSessionView | null;
}) {
  const [tab, setTab] = useState<Tab>(live !== null ? "live" : "activity");
  const [index, setIndex] = useState(0);
  const current = stories[index] ?? null;

  useEffect(() => {
    if (live === null && tab === "live") {
      setTab("activity");
    }
  }, [live, tab]);

  const tabs: Array<{ id: Tab; label: string }> =
    live === null
      ? [{ id: "activity", label: "Activity" }]
      : [
          { id: "activity", label: "Activity" },
          { id: "live", label: "Live" },
        ];

  return (
    <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
      {tabs.length > 1 ? (
        <div style={{ width: "100%", maxWidth: 360 }}>
          <SegmentedTabs label="Presence" tabs={tabs} active={tab} onChange={setTab} />
        </div>
      ) : null}

      {tab === "live" && live !== null ? (
        <LiveStage live={live} />
      ) : current === null ? (
        <p style={{ color: cssVar("mutedText") }}>
          No active story. The map pin still shows their profile.
        </p>
      ) : (
        <StoryStage
          story={current}
          index={index}
          total={stories.length}
          onBack={() => setIndex((value) => Math.max(0, value - 1))}
          onNext={() => setIndex((value) => Math.min(stories.length - 1, value + 1))}
        />
      )}
    </div>
  );
}

function StoryStage({
  story,
  index,
  total,
  onBack,
  onNext,
}: {
  story: StoryView;
  index: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSrc = storyAudioSrc(story);
  const preparing = story.kind === "VIDEO" && story.playbackStatus === "PENDING";
  const hlsUrl = preparing ? null : (story.hlsUrl ?? story.previewHlsUrl);

  useHls(videoRef, hlsUrl);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) {
      return;
    }
    video.muted = mutesOriginalAudio(story.kind, story.originalAudioMode);
    video.currentTime = story.trimStartSeconds;
    const onTime = (): void => {
      const next = loopWithin(video.currentTime, story.trimStartSeconds, story.trimEndSeconds);
      if (next !== video.currentTime) {
        video.currentTime = next;
      }
    };
    video.addEventListener("timeupdate", onTime);
    return () => {
      video.removeEventListener("timeupdate", onTime);
    };
  }, [story]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio === null || audioSrc === null) {
      return;
    }
    audio.currentTime = story.audio.startSeconds;
    void audio.play().catch(() => undefined);
    const onTime = (): void => {
      const next = loopWithin(audio.currentTime, story.audio.startSeconds, story.audio.endSeconds);
      if (next !== audio.currentTime) {
        audio.currentTime = next;
      }
    };
    audio.addEventListener("timeupdate", onTime);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
    };
  }, [audioSrc, story]);

  return (
    <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 360 }}>
      <StageFrame>
        {story.imageUrl !== null ? (
          // Local or signed CDN URL; next/image is not configured for every host.
          <img
            src={story.imageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : null}
        {preparing ? (
          <p
            style={{
              margin: 0,
              padding: 24,
              color: cssVar("textOnPrimary"),
              textAlign: "center",
            }}
          >
            Preparing playback
          </p>
        ) : null}
        {hlsUrl !== null ? (
          <video
            ref={videoRef}
            controls
            playsInline
            autoPlay
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : null}
        {story.caption.trim().length === 0 ? null : (
          <p
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: 24,
              margin: 0,
              padding: "8px 12px",
              borderRadius: cssVar("radius"),
              background: "color-mix(in srgb, var(--hasut-color-text) 55%, transparent)",
              color: story.captionColor ?? cssVar("textOnPrimary"),
              fontWeight: 700,
              textAlign: "center",
              wordBreak: "break-word",
            }}
          >
            {story.caption}
          </p>
        )}
      </StageFrame>
      {audioSrc === null ? null : <audio ref={audioRef} src={audioSrc} hidden />}
      {story.audio.title === null || audioSrc === null ? null : (
        <p style={{ margin: 0, fontSize: 13, color: cssVar("mutedText") }}>{story.audio.title}</p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" onClick={onBack} disabled={index === 0}>
          Back
        </Button>
        <Button onClick={onNext} disabled={index >= total - 1}>
          Next
        </Button>
      </div>
    </div>
  );
}

function LiveStage({ live }: { live: LiveSessionView }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playlistUrl = live.hlsUrl ?? live.previewHlsUrl;
  const ready = useLivePlaylist(playlistUrl);
  useHls(videoRef, ready ? playlistUrl : null);

  return (
    <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 360 }}>
      <StageFrame>
        {ready ? (
          <video
            ref={videoRef}
            controls
            playsInline
            autoPlay
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <p
            style={{
              margin: 0,
              padding: 24,
              color: cssVar("textOnPrimary"),
              textAlign: "center",
            }}
          >
            Waiting for the live preview
          </p>
        )}
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            top: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: cssVar("danger"),
            }}
          />
          <strong style={{ color: cssVar("textOnPrimary") }}>
            {live.title.length === 0 ? "Live" : live.title}
          </strong>
        </div>
      </StageFrame>
      <p style={{ margin: 0, fontSize: 13, color: cssVar("mutedText") }}>
        {live.audience === "PATRONS" ? "Visible to Patrons" : "Visible to everyone nearby"}
      </p>
    </div>
  );
}

function StageFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "9 / 16",
        maxHeight: "70dvh",
        borderRadius: cssVar("cardRadius"),
        overflow: "hidden",
        background: cssVar("text"),
      }}
    >
      {children}
    </div>
  );
}

function useLivePlaylist(url: string | null): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (url === null) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const probe = (): void => {
      void fetch(url)
        .then(async (response) => {
          const body = response.ok ? await response.text() : "";
          return isLivePlaylist(response.status, body);
        })
        .then((ok) => {
          if (cancelled) {
            return;
          }
          if (ok) {
            setReady(true);
            return;
          }
          timer = setTimeout(probe, LIVE_PLAYLIST_POLL_MS);
        })
        .catch(() => {
          if (!cancelled) {
            timer = setTimeout(probe, LIVE_PLAYLIST_POLL_MS);
          }
        });
    };
    probe();
    return () => {
      cancelled = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [url]);
  return ready;
}

function useHls(ref: RefObject<HTMLVideoElement | null>, url: string | null): void {
  useEffect(() => {
    const node = ref.current;
    if (node === null || url === null) {
      return;
    }
    let cancelled = false;
    let instance: { destroy: () => void } | null = null;
    void import("hls.js").then((mod) => {
      if (cancelled) {
        return;
      }
      const Hls = mod.default;
      if (Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 8 });
        hls.loadSource(url);
        hls.attachMedia(node);
        instance = hls;
        return;
      }
      node.src = url;
    });
    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [ref, url]);
}
