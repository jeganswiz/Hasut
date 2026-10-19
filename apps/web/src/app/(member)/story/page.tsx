"use client";

import { apiErrorMessage, hasutErrorCode } from "@hasut/api-client";
import type {
  AudioTrackView,
  LiveComposerConfig,
  StoryComposerConfig,
  StoryView,
} from "@hasut/types";
import { Surface, type SurfaceState } from "@hasut/ui";
import { useEffect, useState } from "react";
import { HostStudio } from "../../../components/live/host-studio";
import { StoryComposer } from "../../../components/story/story-composer";
import { createWebApiClient } from "../../../lib/api";
import { redirectToLogin } from "../../../lib/member-nav";

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
        if (cancelled) {
          return;
        }
        const code = hasutErrorCode(error);
        if (code === "UNAUTHENTICATED") {
          redirectToLogin("/story");
          return;
        }
        if (code === "FORBIDDEN") {
          setState("empty");
          setMessage("Stories are not available right now.");
          return;
        }
        setState("error");
        setMessage(apiErrorMessage(error, "Stories are not available right now."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="presence-page">
      <h1>Presence Story</h1>
      <p className="ps-lede">
        Share what you&apos;re working on, where you are, and what&apos;s happening — in real time.
      </p>
      <div className="ps-modes" role="tablist" aria-label="Story section">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "activity"}
          className={tab === "activity" ? "is-active" : ""}
          onClick={() => setTab("activity")}
        >
          Activity
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "live"}
          className={tab === "live" ? "is-active" : ""}
          onClick={() => setTab("live")}
        >
          Live
        </button>
      </div>
      {state !== "success" || config === null ? (
        <Surface state={state} title={tab === "activity" ? "Activity" : "Live presence"}>
          <p>{message}</p>
        </Surface>
      ) : tab === "activity" ? (
        <>
          <StoryComposer config={config} tracks={tracks} onPublished={setPublished} />
          {published === null ? null : (
            <p className="hint">Live until {new Date(published.expiresAt).toLocaleTimeString()}.</p>
          )}
        </>
      ) : (
        <LiveTab onClose={() => setTab("activity")} />
      )}
    </main>
  );
}

function LiveTab({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<LiveComposerConfig | null>(null);
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading the live studio…");

  useEffect(() => {
    let cancelled = false;
    void createWebApiClient()
      .liveComposerConfig()
      .then((next) => {
        if (!cancelled) {
          setConfig(next);
          setState("success");
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setState("error");
        setMessage(apiErrorMessage(error, "Live is not available right now."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state !== "success" || config === null) {
    return (
      <Surface state={state} title="Live presence">
        <p>{message}</p>
      </Surface>
    );
  }
  return <HostStudio config={config} onClose={onClose} />;
}
