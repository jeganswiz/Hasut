"use client";

import type { LiveSessionView, StoryAudience } from "@hasut/types";
import { Button, TextField, cssVar } from "@hasut/ui";
import { useEffect, useRef, useState } from "react";
import { createWebApiClient } from "../../lib/api";
import { IDLE, failure, loading, success, type AuthFeedback } from "../../lib/auth-flow";
import { publishWhip, reachableIngestUrl, whipEndRequest, type WhipPeer } from "../../lib/whip";
import { AuthFeedbackNote } from "../auth/auth-feedback";
import { AudiencePicker } from "./audience-picker";

const TITLE_MAX_LENGTH = 80;

export function LiveComposer({ patronCount }: { patronCount: number }) {
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState<StoryAudience>("EVERYONE");
  const [session, setSession] = useState<LiveSessionView | null>(null);
  const [feedback, setFeedback] = useState<AuthFeedback>(IDLE);
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const closePublish = useRef<(() => void) | null>(null);

  const busy = feedback.status === "loading";

  useEffect(() => {
    const video = videoRef.current;
    if (video !== null) {
      video.srcObject = preview;
    }
  }, [preview, session]);

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
        void sendCamera(current.ingestUrl, closePublish, setPreview).catch(() => {
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
      await sendCamera(started.ingestUrl, closePublish, setPreview);
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

  if (session !== null) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: cssVar("radius"),
            background: cssVar("background"),
            border: `1px solid ${cssVar("border")}`,
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
          <strong style={{ fontSize: 15 }}>{session.title}</strong>
          <span style={{ fontSize: 13, color: cssVar("mutedText") }}>
            Live now · {session.audience === "PATRONS" ? "Patrons only" : "Everyone nearby"}
          </span>
        </div>
        {preview === null ? null : (
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            style={{
              width: "100%",
              maxWidth: 360,
              aspectRatio: "9 / 16",
              borderRadius: cssVar("cardRadius"),
              background: cssVar("text"),
              objectFit: "cover",
            }}
          />
        )}
        <AuthFeedbackNote feedback={feedback} />
        <Button variant="secondary" onClick={() => void stop()} disabled={busy}>
          {busy ? "Ending…" : "End live"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 480 }}>
      <p style={{ margin: 0, fontSize: 14, color: cssVar("mutedText") }}>
        Going live puts a live preview on your map pin. It replaces any story preview while you are
        broadcasting.
      </p>
      <TextField
        label="Live title"
        value={title}
        onChange={setTitle}
        placeholder="Rewiring a shop board"
        maxLength={TITLE_MAX_LENGTH}
        disabled={busy}
      />
      <span style={{ fontSize: 13, color: cssVar("mutedText") }}>
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
  );
}

async function sendCamera(
  ingestUrl: string,
  closePublish: { current: (() => void) | null },
  setPreview: (stream: MediaStream | null) => void,
): Promise<void> {
  releaseCamera(closePublish, setPreview);
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
