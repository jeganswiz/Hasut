"use client";

import type { LiveSessionView, StoryAudience } from "@hasut/types";
import { Button, TextField, cssVar } from "@hasut/ui";
import { useEffect, useState } from "react";
import { createWebApiClient } from "../../lib/api";
import { IDLE, failure, loading, success, type AuthFeedback } from "../../lib/auth-flow";
import { AuthFeedbackNote } from "../auth/auth-feedback";
import { AudiencePicker } from "./audience-picker";

const TITLE_MAX_LENGTH = 80;

export function LiveComposer({ patronCount }: { patronCount: number }) {
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState<StoryAudience>("EVERYONE");
  const [session, setSession] = useState<LiveSessionView | null>(null);
  const [feedback, setFeedback] = useState<AuthFeedback>(IDLE);

  const busy = feedback.status === "loading";

  useEffect(() => {
    let cancelled = false;
    void createWebApiClient()
      .getMyLive()
      .then((current) => {
        if (!cancelled && current !== null) {
          setSession(current);
          setTitle(current.title);
          setAudience(current.audience);
        }
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
    try {
      const started = await createWebApiClient().startLive({ title, audience });
      setSession(started);
      setFeedback(
        success(
          started.audience === "PATRONS"
            ? "You are live for your Patrons. Only they see the preview on your pin."
            : "You are live. Your map pin now shows the live preview.",
        ),
      );
    } catch (error) {
      setFeedback(failure(error, "Unable to go live."));
    }
  }

  async function stop(): Promise<void> {
    setFeedback(loading("Ending your live session…"));
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
        <dl style={{ margin: 0, display: "grid", gap: 4, fontSize: 13 }}>
          <dt style={{ color: cssVar("mutedText") }}>Ingest</dt>
          <dd style={{ margin: 0, wordBreak: "break-all" }}>
            {session.ingestUrl ?? "Waiting for the media server"}
          </dd>
          <dt style={{ color: cssVar("mutedText") }}>Playback</dt>
          <dd style={{ margin: 0, wordBreak: "break-all" }}>
            {session.hlsUrl ?? "Pending ingest"}
          </dd>
        </dl>
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
