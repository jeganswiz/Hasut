"use client";

import { HasutApiError } from "@hasut/api-client";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useState } from "react";
import { AppNav } from "../../components/app-nav";
import { createWebApiClient } from "../../lib/api";

async function upload(
  file: File,
  purpose: "STORY_IMAGE" | "STORY_VIDEO" | "STORY_AUDIO",
): Promise<string> {
  const client = createWebApiClient();
  const presign = await client.presignMedia({
    purpose,
    mimeType: file.type || "application/octet-stream",
    byteSize: file.size,
  });
  await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers,
    body: file,
  });
  await client.completeMedia({ mediaId: presign.mediaId });
  return presign.mediaId;
}

export default function StoryComposerPage() {
  const [state, setState] = useState<SurfaceState>("empty");
  const [message, setMessage] = useState(
    "Add a 24-hour map presence. Image, optional audio, or a trimmed video. This is not a social feed.",
  );
  const [trimStart, setTrimStart] = useState("0");
  const [trimEnd, setTrimEnd] = useState("15");

  return (
    <main>
      <AppNav />
      <h1>Presence story</h1>
      <Surface state={state} title="Composer">
        <p>{message}</p>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const image = data.get("image");
            const video = data.get("video");
            const audio = data.get("audio");
            void (async () => {
              setState("loading");
              try {
                if (video instanceof File && video.size > 0) {
                  const videoMediaId = await upload(video, "STORY_VIDEO");
                  const audioMediaId =
                    audio instanceof File && audio.size > 0
                      ? await upload(audio, "STORY_AUDIO")
                      : null;
                  await createWebApiClient().createStory({
                    kind: "VIDEO",
                    videoMediaId,
                    audioMediaId,
                    trimStartSeconds: Number(trimStart),
                    trimEndSeconds: Number(trimEnd),
                  });
                } else if (image instanceof File && image.size > 0) {
                  const imageMediaId = await upload(image, "STORY_IMAGE");
                  const audioMediaId =
                    audio instanceof File && audio.size > 0
                      ? await upload(audio, "STORY_AUDIO")
                      : null;
                  await createWebApiClient().createStory({
                    kind: "IMAGE",
                    imageMediaId,
                    audioMediaId,
                  });
                } else {
                  setState("error");
                  setMessage("Choose an image or video.");
                  return;
                }
                setState("success");
                setMessage("Story published for 24 hours. Your map pin stays a circle.");
              } catch (error) {
                setState("error");
                setMessage(error instanceof HasutApiError ? error.message : "Unable to publish.");
              }
            })();
          }}
        >
          <label>
            Image
            <input type="file" name="image" accept="image/*" />
          </label>
          <label>
            Optional audio
            <input type="file" name="audio" accept="audio/*" />
          </label>
          <label>
            Video
            <input type="file" name="video" accept="video/*" />
          </label>
          <label>
            Trim start (seconds)
            <input value={trimStart} onChange={(event) => setTrimStart(event.target.value)} />
          </label>
          <label>
            Trim end (seconds)
            <input value={trimEnd} onChange={(event) => setTrimEnd(event.target.value)} />
          </label>
          <Button type="submit">Publish story</Button>
        </form>
        <Button
          variant="secondary"
          onClick={() =>
            void createWebApiClient()
              .startLive()
              .then((live) => {
                setState("success");
                setMessage(`Live started. HLS: ${live.hlsUrl ?? "pending ingest"}`);
              })
              .catch((error: unknown) => {
                setState("error");
                setMessage(error instanceof HasutApiError ? error.message : "Unable to go live.");
              })
          }
        >
          Go live
        </Button>
      </Surface>
    </main>
  );
}
