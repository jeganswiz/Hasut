"use client";

import { HasutApiError } from "@hasut/api-client";
import type { StoryView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createWebApiClient } from "../../../lib/api";

export default function StoryViewerPage() {
  const params = useParams<{ memberId: string }>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading presence…");
  const [stories, setStories] = useState<StoryView[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    void createWebApiClient()
      .listMemberStories(params.memberId)
      .then((data) => {
        setStories(data);
        setState(data.length === 0 ? "empty" : "success");
        setMessage(
          data.length === 0 ? "No active story. The map pin still shows their profile." : "",
        );
      })
      .catch((error: unknown) => {
        setState("error");
        setMessage(error instanceof HasutApiError ? error.message : "Unable to open this story.");
      });
  }, [params.memberId]);

  const current = stories[index] ?? null;

  useEffect(() => {
    const node = videoRef.current;
    const url = current?.hlsUrl ?? current?.previewHlsUrl;
    if (node === null || url === null || url === undefined) {
      return;
    }
    let cancelled = false;
    void import("hls.js").then((mod) => {
      if (cancelled) {
        return;
      }
      const Hls = mod.default;
      if (Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 8 });
        hls.loadSource(url);
        hls.attachMedia(node);
        return;
      }
      node.src = url;
    });
    return () => {
      cancelled = true;
    };
  }, [current]);

  return (
    <main className="story-viewer">
      <Surface state={state} title="Story">
        <p>{message}</p>
        {current?.imageUrl ? <img src={current.imageUrl} alt="" /> : null}
        {current?.hlsUrl || current?.previewHlsUrl ? (
          <video ref={videoRef} controls playsInline />
        ) : null}
        {current?.audioUrl ? <audio src={current.audioUrl} controls /> : null}
        <div className="actions">
          <Button variant="secondary" onClick={() => setIndex((value) => Math.max(0, value - 1))}>
            Back
          </Button>
          <Button onClick={() => setIndex((value) => Math.min(stories.length - 1, value + 1))}>
            Next
          </Button>
          <a href="/">Map</a>
        </div>
      </Surface>
    </main>
  );
}
