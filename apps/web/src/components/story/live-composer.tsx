"use client";

import type { LiveSessionView, StoryAudience } from "@hasut/types";
import { Button, TextField } from "@hasut/ui";
import { useEffect, useRef, useState } from "react";
import { createWebApiClient } from "../../lib/api";
import { IDLE, failure, loading, success, type AuthFeedback } from "../../lib/auth-flow";
import { publishWhip, reachableIngestUrl, whipEndRequest, type WhipPeer } from "../../lib/whip";
import { AuthFeedbackNote } from "../auth/auth-feedback";
import { AudiencePicker } from "./audience-picker";

const TITLE_MAX_LENGTH = 80;

export function LiveComposer({
  patronCount,
  onClose,
}: {
  patronCount: number;
  onClose?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState<StoryAudience>("EVERYONE");
  const [session, setSession] = useState<LiveSessionView | null>(null);
  const [feedback, setFeedback] = useState<AuthFeedback>(IDLE);
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [place, setPlace] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const closePublish = useRef<(() => void) | null>(null);
  const facing = useRef<"user" | "environment">("user");

  const busy = feedback.status === "loading";

  useEffect(() => {
    const video = videoRef.current;
    if (video !== null) {
      video.srcObject = preview;
    }
  }, [preview, session]);

  useEffect(() => {
    setMicOn(true);
    setCameraOn(true);
  }, [preview]);

  useEffect(() => {
    if (session === null) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    void createWebApiClient()
      .getMyProfile()
      .then((profile) => setPlace(profile.approximateLocation?.label ?? null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    return () => {
      closePublish.current?.();
      closePublish.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void createWebApiClient()
      .getMyLive()
      .then((current) => {
        if (cancelled || current === null) {
          return;
        }
        setSession(current);
        setTitle(current.title);
        setAudience(current.audience);
        if (!reachableIngestUrl(current.ingestUrl)) {
          return;
        }
        void sendCamera(current.ingestUrl, closePublish, setPreview, facing.current).catch(() => {
          if (!cancelled) {
            setFeedback({
              status: "error",
              message: "You are still live, but the camera could not reconnect.",
            });
          }
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function goLive(): Promise<void> {
    if (title.trim().length === 0) {
      setFeedback({ status: "error", message: "Give your live a title so people know to join." });
      return;
    }
    setFeedback(loading("Opening your live session…"));
    const client = createWebApiClient();
    let started: LiveSessionView | null = null;
    try {
      started = await client.startLive({ title, audience });
      if (!reachableIngestUrl(started.ingestUrl)) {
        setSession(started);
        setFeedback(
          success(
            started.audience === "PATRONS"
              ? "You are live for your Patrons. The camera stays off until the media server is configured."
              : "You are live. The camera stays off until the media server is configured.",
          ),
        );
        return;
      }
      setFeedback(loading("Connecting your camera…"));
      await sendCamera(started.ingestUrl, closePublish, setPreview, facing.current);
      setSession(started);
      setFeedback(
        success(
          started.audience === "PATRONS"
            ? "You are live for your Patrons. Your camera is sending."
            : "You are live. Your camera is sending.",
        ),
      );
    } catch (error) {
      releaseCamera(closePublish, setPreview);
      if (started !== null) {
        await client.endLive().catch(() => undefined);
      }
      setSession(null);
      setFeedback(failure(error, "Unable to go live."));
    }
  }

  async function stop(): Promise<void> {
    setFeedback(loading("Ending your live session…"));
    releaseCamera(closePublish, setPreview);
    try {
      await createWebApiClient().endLive();
      setSession(null);
      setTitle("");
      setFeedback(success("Live ended. Your pin is back to your profile."));
    } catch (error) {
      setFeedback(failure(error, "Unable to end the session."));
    }
  }

  async function flipCamera(): Promise<void> {
    if (session === null || !reachableIngestUrl(session.ingestUrl)) {
      return;
    }
    facing.current = facing.current === "user" ? "environment" : "user";
    try {
      await sendCamera(session.ingestUrl, closePublish, setPreview, facing.current);
    } catch (error) {
      setFeedback(failure(error, "You are still live, but the camera could not reconnect."));
    }
  }

  const audienceLabel =
    (session?.audience ?? audience) === "PATRONS" ? "Patrons only" : "Everyone nearby";

  return (
    <div className="ps-live">
      <div className="story-frame ps-live-frame">
        {session !== null && preview !== null ? (
          <video ref={videoRef} muted playsInline autoPlay className="live-camera" />
        ) : (
          <p className="live-waiting">
            {session === null ? "Your camera appears here when you go live." : "Camera is off."}
          </p>
        )}
        <div className="ps-live-top">
          <button type="button" className="ps-round" aria-label="Close" onClick={onClose}>
            ×
          </button>
          {session === null ? (
            <span className="ps-live-pill is-idle">LIVE</span>
          ) : (
            <span className="ps-live-pill">
              <span className="live-dot" aria-hidden />
              LIVE {formatElapsed(session.startedAt, now)}
            </span>
          )}
          <span className="ps-aud-chip">{audienceLabel}</span>
          {session === null ? null : (
            <button type="button" className="ps-end" disabled={busy} onClick={() => void stop()}>
              {busy ? "Ending…" : "End Live"}
            </button>
          )}
        </div>
        {session === null ? null : <p className="ps-live-caption">{session.title}</p>}
        {place === null ? null : <span className="ps-loc ps-live-place">{place}</span>}
        {session !== null && preview !== null ? (
          <button
            type="button"
            className="ps-flip"
            aria-label="Switch camera"
            disabled={busy}
            onClick={() => void flipCamera()}
          >
            ↻
          </button>
        ) : null}
      </div>
      {session === null ? (
        <div className="ps-card ps-live-form">
          <p className="hint">
            Going live puts a live preview on your map pin. It replaces any story preview while you
            are broadcasting.
          </p>
          <TextField
            label="Live title"
            value={title}
            onChange={setTitle}
            placeholder="Rewiring a shop board"
            maxLength={TITLE_MAX_LENGTH}
            disabled={busy}
          />
          <span className="hint">
            {title.length} / {TITLE_MAX_LENGTH}
          </span>
          <AudiencePicker
            value={audience}
            onChange={setAudience}
            patronCount={patronCount}
            disabled={busy}
          />
          <AuthFeedbackNote feedback={feedback} />
          <Button onClick={() => void goLive()} disabled={busy}>
            {busy ? "Starting…" : "Go live"}
          </Button>
        </div>
      ) : (
        <div className="ps-live-extra">
          <AuthFeedbackNote feedback={feedback} />
          {preview === null ? null : (
            <div className="studio-pills">
              <button
                type="button"
                className="studio-pill"
                disabled={busy}
                onClick={() => toggleTrack(preview, "audio", setMicOn)}
              >
                {micOn ? "Mute" : "Unmute"}
              </button>
              <button
                type="button"
                className="studio-pill"
                disabled={busy}
                onClick={() => toggleTrack(preview, "video", setCameraOn)}
              >
                {cameraOn ? "Camera off" : "Camera on"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

async function sendCamera(
  ingestUrl: string,
  closePublish: { current: (() => void) | null },
  setPreview: (stream: MediaStream | null) => void,
  facing: "user" | "environment" = "user",
): Promise<void> {
  releaseCamera(closePublish, setPreview);
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: facing },
    audio: true,
  });
  try {
    const handle = await publishWhip({
      ingestUrl,
      stream,
      createConnection: () => new RTCPeerConnection() as WhipPeer,
      post: async (request) => {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });
        return {
          status: response.status,
          body: await response.text(),
          location: response.headers.get("Location"),
        };
      },
    });
    const end = whipEndRequest(handle.resourceUrl);
    closePublish.current = () => {
      handle.close();
      stopTracks(stream);
      if (end !== null) {
        void fetch(end.url, { method: end.method }).catch(() => undefined);
      }
    };
    setPreview(stream);
  } catch (error) {
    stopTracks(stream);
    throw error;
  }
}

function releaseCamera(
  closePublish: { current: (() => void) | null },
  setPreview: (stream: MediaStream | null) => void,
): void {
  closePublish.current?.();
  closePublish.current = null;
  setPreview(null);
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function toggleTrack(
  stream: MediaStream,
  kind: "audio" | "video",
  setOn: (next: boolean) => void,
): void {
  const track = kind === "audio" ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
  if (track === undefined) {
    return;
  }
  track.enabled = !track.enabled;
  setOn(track.enabled);
}

function formatElapsed(startedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remain = seconds % 60;
  return [hours, minutes, remain].map((part) => String(part).padStart(2, "0")).join(":");
}
