"use client";

import type { AudioTrackView, StoryComposerConfig, StoryView } from "@hasut/types";
import { SegmentedTabs, Surface, cssVar, type SurfaceState } from "@hasut/ui";
import { useEffect, useState } from "react";
import { AppNav } from "../../components/app-nav";
import { LiveComposer } from "../../components/story/live-composer";
import { StoryComposer } from "../../components/story/story-composer";
import { createWebApiClient } from "../../lib/api";
import { apiErrorMessage } from "@hasut/api-client";

type Tab = "activity" | "live";

export default function StoryComposerPage() {
  const [tab, setTab] = useState<Tab>("activity");
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading the composer…");
  const [config, setConfig] = useState<StoryComposerConfig | null>(null);
  const [tracks, setTracks] = useState<AudioTrackView[]>([]);
  const [published, setPublished] = useState<StoryView | null>(null);

  useEffect(() => {
    let cancelled = false;
    const client = createWebApiClient();
    void (async () => {
      try {
        const composer = await client.storyComposerConfig();
        // A missing library should not block posting, so it is fetched separately.
        const library = composer.audioLibraryEnabled
          ? await client.listAudioTracks().catch(() => [])
          : [];
        if (cancelled) {
          return;
        }
        setConfig(composer);
        setTracks(library);
        setState("success");
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setMessage(apiErrorMessage(error, "Stories are not available right now."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <AppNav />
      <h1>Presence story</h1>
      <p style={{ color: cssVar("mutedText"), marginTop: 0 }}>
        A 24-hour presence on the discovery map. This is not a social feed.
      </p>

      <div style={{ maxWidth: 360, marginBottom: 16 }}>
        <SegmentedTabs
          label="Story section"
          tabs={[
            { id: "activity", label: "Activity" },
            { id: "live", label: "Live" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <Surface state={state} title={tab === "activity" ? "Compose" : "Go live"}>
        {state !== "success" || config === null ? (
          <p>{message}</p>
        ) : tab === "activity" ? (
          <>
            <StoryComposer config={config} tracks={tracks} onPublished={setPublished} />
            {published === null ? null : (
              <p style={{ marginTop: 16, fontSize: 14, color: cssVar("mutedText") }}>
                Live until {new Date(published.expiresAt).toLocaleTimeString()}.
              </p>
            )}
          </>
        ) : (
          <LiveComposer patronCount={config.patronCount} />
        )}
      </Surface>
    </main>
  );
}
