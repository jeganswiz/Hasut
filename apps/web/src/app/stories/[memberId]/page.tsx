"use client";

import { HasutApiError } from "@hasut/api-client";
import type { LiveSessionView, StoryView } from "@hasut/types";
import { Surface, type SurfaceState } from "@hasut/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNav } from "../../../components/app-nav";
import { PresenceViewer } from "../../../components/story/presence-viewer";
import { createWebApiClient } from "../../../lib/api";
import { markStoryWatched } from "../../../lib/story-ring";

export default function StoryViewerPage() {
  const params = useParams<{ memberId: string }>();
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading presence…");
  const [stories, setStories] = useState<StoryView[]>([]);
  const [live, setLive] = useState<LiveSessionView | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);

  useEffect(() => {
    const client = createWebApiClient();
    void Promise.all([
      client.listMemberStories(params.memberId),
      client.getMemberLive(params.memberId).catch(() => null),
      client.me().catch(() => null),
    ])
      .then(([nextStories, nextLive, me]) => {
        setStories(nextStories);
        setLive(nextLive);
        setViewerId(me?.id ?? null);
        const empty = nextStories.length === 0 && nextLive === null;
        setState(empty ? "empty" : "success");
        setMessage(empty ? "No active story. The map pin still shows their profile." : "");
      })
      .catch((error: unknown) => {
        setState("error");
        setMessage(error instanceof HasutApiError ? error.message : "Unable to open this story.");
      });
  }, [params.memberId]);

  return (
    <main className="story-viewer">
      <AppNav />
      <Surface state={state} title="Presence">
        {state === "success" ? (
          <PresenceViewer
            stories={stories}
            live={live}
            ownerId={params.memberId}
            viewerId={viewerId}
            onStorySeen={(storyId) => {
              markStoryWatched(window.localStorage, storyId);
              if (viewerId !== null && viewerId !== params.memberId) {
                void createWebApiClient()
                  .recordStoryView(storyId)
                  .catch(() => undefined);
              }
            }}
          />
        ) : (
          <p>{message}</p>
        )}
        <p style={{ marginTop: 16 }}>
          <a href="/">Map</a>
        </p>
      </Surface>
    </main>
  );
}
