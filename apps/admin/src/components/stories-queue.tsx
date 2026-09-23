"use client";

import { HasutApiError } from "@hasut/api-client";
import type { LiveSessionView, StoryAudience, StoryView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { useAdminSession } from "../lib/use-admin-session";

function audienceLabel(audience: StoryAudience): string {
  return audience === "PATRONS" ? "Patrons" : "Everyone";
}

/** Moderators need to see what a story will sound like before they judge it. */
function describeSound(story: StoryView): string {
  const original =
    story.kind === "VIDEO" && story.originalAudioMode !== "KEEP"
      ? story.originalAudioMode === "MUTE"
        ? "original muted"
        : "layered on original"
      : null;
  const added =
    story.audio.source === "LIBRARY"
      ? (story.audio.title ?? "HASUT track")
      : story.audio.source === "UPLOAD"
        ? "member upload"
        : null;
  const parts = [added, original].filter((part): part is string => part !== null);
  return parts.length === 0 ? "—" : parts.join(" · ");
}

export function StoriesQueue() {
  const { ready, denied } = useAdminSession(["ADMIN", "MODERATOR"]);
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading presence stories…");
  const [stories, setStories] = useState<StoryView[]>([]);
  const [lives, setLives] = useState<LiveSessionView[]>([]);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [queue, liveQueue] = await Promise.all([
        createAdminApiClient().listAdminStories(),
        createAdminApiClient().listAdminLive(),
      ]);
      setStories(queue);
      setLives(liveQueue);
      const empty = queue.length === 0 && liveQueue.length === 0;
      setState(empty ? "empty" : "success");
      setMessage(
        empty
          ? "No stories or live sessions to moderate."
          : "Hide a story or end a live. Identity is not skill verification.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load stories.");
    }
  }, []);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [load, ready]);

  if (denied !== null) {
    return (
      <Surface state="error" title="Stories">
        <p>{denied}</p>
      </Surface>
    );
  }

  async function hide(id: string): Promise<void> {
    setState("loading");
    try {
      await createAdminApiClient().hideStory(id);
      await load();
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to hide this story.");
    }
  }

  async function endLive(id: string): Promise<void> {
    setState("loading");
    try {
      await createAdminApiClient().endAdminLive(id);
      await load();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof HasutApiError ? error.message : "Unable to end this live session.",
      );
    }
  }

  return (
    <Surface state={state} title="Stories and live">
      <p>{message}</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Kind</th>
            <th>Member</th>
            <th>Caption or title</th>
            <th>Audience</th>
            <th>Sound</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lives.map((item) => (
            <tr key={item.id}>
              <td>LIVE</td>
              <td>{item.memberId.slice(0, 8)}</td>
              <td>{item.title.length === 0 ? "—" : item.title}</td>
              <td>{audienceLabel(item.audience)}</td>
              <td>—</td>
              <td>{item.status}</td>
              <td>
                <Button onClick={() => void endLive(item.id)}>End live</Button>
              </td>
            </tr>
          ))}
          {stories.map((item) => (
            <tr key={item.id}>
              <td>
                {item.kind}
                {item.playbackStatus === "PENDING" ? " · preparing" : ""}
              </td>
              <td>{item.memberId.slice(0, 8)}</td>
              <td>{item.caption.length === 0 ? "—" : item.caption}</td>
              <td>{audienceLabel(item.audience)}</td>
              <td>{describeSound(item)}</td>
              <td>{item.moderationStatus}</td>
              <td>
                {item.moderationStatus === "ACTIVE" ? (
                  <Button onClick={() => void hide(item.id)}>Hide</Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}
