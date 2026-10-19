"use client";

import type { LiveChatMessageView, LiveSessionView } from "@hasut/types";
import { Button, Surface } from "@hasut/ui";
import { createHasutLiveRealtimeClient, hasutErrorCode } from "@hasut/api-client";
import { useEffect, useRef, useState } from "react";
import { createWebApiClient, webApiBaseUrl } from "../../lib/api";
import { formatLiveClock } from "../../lib/live-devices";
import { playlistIsReady } from "../../lib/live-playlist";
import { nextPlayerPhase, type LivePlayerPhase } from "../../lib/live-player-state";
import { webTokenStorage } from "../../lib/token-storage";
import { LiveChatPanel } from "./live-chat-panel";

export function LivePlayer({ liveId }: { liveId: string }) {
  const [live, setLive] = useState<LiveSessionView | null>(null);
  const [phase, setPhase] = useState<LivePlayerPhase>("loading");
  const [messages, setMessages] = useState<LiveChatMessageView[]>([]);
  const [pinned, setPinned] = useState<LiveChatMessageView | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [chatOpen, setChatOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void createWebApiClient()
      .getLive(liveId)
      .then((session) => {
        if (cancelled) {
          return;
        }
        setLive(session);
        if (
          session.status === "ENDED" &&
          session.recordingStatus === "READY" &&
          session.hlsUrl !== null
        ) {
          setPhase("waiting");
        } else {
          setPhase(session.status === "ENDED" ? "ended" : "waiting");
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setPhase(hasutErrorCode(error) === "NOT_FOUND" ? "restricted" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [liveId]);

  useEffect(() => {
    if (live === null || (live.status !== "LIVE" && live.recordingStatus !== "READY")) {
      return;
    }
    const url = live.hlsUrl ?? live.previewHlsUrl;
    if (url === null) {
      return;
    }
    let cancelled = false;
    const probe = (): void => {
      void playlistIsReady(url)
        .then((ready) => {
          if (!cancelled && ready) {
            setPhase((current) => nextPlayerPhase(current, "ready"));
          } else if (!cancelled) {
            window.setTimeout(probe, 2000);
          }
        })
        .catch(() => {
          if (!cancelled) {
            window.setTimeout(probe, 2000);
          }
        });
    };
    probe();
    return () => {
      cancelled = true;
    };
  }, [live]);

  useEffect(() => {
    const node = videoRef.current;
    const url = live?.hlsUrl ?? live?.previewHlsUrl ?? null;
    if (node === null || url === null || phase !== "playing") {
      return;
    }
    let instance: { destroy: () => void } | null = null;
    void import("hls.js").then((mod) => {
      const Hls = mod.default;
      if (Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 8, capLevelToPlayerSize: true });
        hls.loadSource(url);
        hls.attachMedia(node);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setPhase((current) => nextPlayerPhase(current, "fatal"));
          }
        });
        instance = hls;
        return;
      }
      node.src = url;
    });
    return () => {
      instance?.destroy();
    };
  }, [live, phase]);

  useEffect(() => {
    if (live === null) {
      return;
    }
    const client = createHasutLiveRealtimeClient({
      baseUrl: webApiBaseUrl(),
      tokenStorage: webTokenStorage,
    });
    void client.connect().then((socket) => {
      socket.emit("join", { liveId: live.id });
      socket.on("chat.message", (payload) => {
        setMessages((current) => [...current, payload as LiveChatMessageView]);
      });
      socket.on("chat.pinned", (payload) => setPinned(payload as LiveChatMessageView | null));
      socket.on("live.ended", () => setPhase("ended"));
      socket.on("viewers.updated", (payload) => {
        const update = payload as { viewerCount: number };
        setLive((current) =>
          current === null ? current : { ...current, viewerCount: update.viewerCount },
        );
      });
    });
    void createWebApiClient()
      .listLiveChat(live.id)
      .then((page) => {
        setMessages(page.messages);
        setPinned(page.pinned);
      })
      .catch(() => undefined);
    const started = Date.now();
    return () => {
      const video = videoRef.current as
        | (HTMLVideoElement & {
            getVideoPlaybackQuality?: () => { droppedVideoFrames: number };
          })
        | null;
      void createWebApiClient()
        .recordLiveMetrics(live.id, {
          startupMs: Date.now() - started,
          reconnects: 0,
          droppedFrames: video?.getVideoPlaybackQuality?.().droppedVideoFrames ?? 0,
        })
        .catch(() => undefined);
      client.disconnect();
    };
  }, [live?.id]);

  if (phase === "restricted") {
    return (
      <Surface state="empty" title="This live is private">
        <p>
          Only invited Patrons can watch. Request a connection from the host profile to become a
          Patron.
        </p>
        {live === null ? null : <a href={`/members/${live.memberId}`}>Open profile</a>}
      </Surface>
    );
  }
  if (phase === "error" || live === null) {
    return (
      <Surface state={phase === "loading" ? "loading" : "error"} title="Live">
        <p>{phase === "loading" ? "Opening the live…" : "This live could not be opened."}</p>
      </Surface>
    );
  }

  const copy =
    phase === "ended"
      ? "This live has ended."
      : phase === "waiting"
        ? "Waiting for the live preview"
        : phase === "reconnecting"
          ? "Reconnecting…"
          : phase === "poor"
            ? "Connection is weak"
            : null;

  return (
    <div className="lv-watch">
      <div className="story-frame ps-live-frame">
        {phase === "playing" ? (
          <video ref={videoRef} controls playsInline autoPlay className="live-camera" />
        ) : (
          <p className="live-waiting">{copy}</p>
        )}
        <div className="ps-live-top">
          <strong className="ps-live-caption">{live.title || "Live"}</strong>
          {live.status === "LIVE" ? (
            <span className="ps-live-pill">
              LIVE {formatLiveClock(live.startedAt, now)} · {live.viewerCount}
            </span>
          ) : (
            <span className="ps-live-pill is-idle">Ended</span>
          )}
        </div>
      </div>
      <div className="lv-watch-meta">
        <p>
          {live.host.displayName} ·{" "}
          {live.audience === "EVERYONE"
            ? "Everyone nearby"
            : live.audience === "PATRONS"
              ? "Patrons"
              : "Private"}
        </p>
        <div className="studio-pills">
          <a className="studio-pill" href={`/members/${live.memberId}`}>
            Profile
          </a>
          <button
            type="button"
            className="studio-pill"
            onClick={() => {
              const url = `${window.location.origin}/live/${live.id}`;
              if (navigator.share !== undefined) {
                void navigator.share({ title: live.title, url });
                return;
              }
              void navigator.clipboard.writeText(url);
            }}
          >
            Share
          </button>
          <button
            type="button"
            className="studio-pill"
            onClick={() =>
              void createWebApiClient().reportLive(live.id, { reasonCode: "spam", details: "" })
            }
          >
            Report
          </button>
          <Button type="button" variant="secondary" onClick={() => setChatOpen((open) => !open)}>
            {chatOpen ? "Hide chat" : "Chat"}
          </Button>
        </div>
        {chatOpen ||
        typeof window === "undefined" ||
        window.matchMedia("(min-width: 860px)").matches ? (
          <LiveChatPanel
            live={live}
            messages={messages}
            pinned={pinned}
            canModerate={false}
            onSend={(body) =>
              createWebApiClient()
                .sendLiveChat(live.id, body)
                .then(() => undefined)
            }
            onReact={(emoji) => {
              const client = createHasutLiveRealtimeClient({
                baseUrl: webApiBaseUrl(),
                tokenStorage: webTokenStorage,
              });
              void client.connect().then((socket) => socket.emit("reaction", { emoji }));
            }}
            onPin={() => undefined}
            onHide={() => undefined}
          />
        ) : null}
      </div>
    </div>
  );
}
