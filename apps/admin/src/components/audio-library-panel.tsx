"use client";

import { HasutApiError } from "@hasut/api-client";
import type { AudioTrackView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { useAdminSession } from "../lib/use-admin-session";

function errorText(error: unknown, fallback: string): string {
  return error instanceof HasutApiError ? error.message : fallback;
}

function readDuration(objectUrl: string): Promise<number | null> {
  return new Promise((resolve) => {
    const probe = document.createElement("audio");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      resolve(Number.isFinite(probe.duration) ? probe.duration : null);
    };
    probe.onerror = () => {
      resolve(null);
    };
    probe.src = objectUrl;
  });
}

export function AudioLibraryPanel() {
  const { ready, denied } = useAdminSession(["ADMIN", "MODERATOR"]);
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading the soundtrack library…");
  const [tracks, setTracks] = useState<AudioTrackView[]>([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [mood, setMood] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const rows = await createAdminApiClient().listAdminAudioTracks();
      setTracks(rows);
      setState(rows.length === 0 ? "empty" : "success");
      setMessage(
        rows.length === 0
          ? "No soundtracks yet. Add one so members have curated audio to choose from."
          : "Members only ever see tracks that are live here.",
      );
    } catch (error) {
      setState("error");
      setMessage(errorText(error, "Unable to load the soundtrack library."));
    }
  }, []);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [load, ready]);

  if (denied !== null) {
    return (
      <Surface state="error" title="Story audio">
        <p>{denied}</p>
      </Surface>
    );
  }

  async function add(): Promise<void> {
    if (file === null || title.trim().length === 0 || artist.trim().length === 0) {
      setState("error");
      setMessage("A title, an artist, and an audio file are all required.");
      return;
    }
    setState("loading");
    try {
      const client = createAdminApiClient();
      const objectUrl = URL.createObjectURL(file);
      const durationSeconds = Math.round((await readDuration(objectUrl)) ?? 0);
      URL.revokeObjectURL(objectUrl);
      if (durationSeconds <= 0) {
        setState("error");
        setMessage("That file did not report a playable duration.");
        return;
      }

      const presign = await client.presignMedia({
        purpose: "STORY_AUDIO",
        mimeType: file.type.length > 0 ? file.type : "application/octet-stream",
        byteSize: file.size,
      });
      await fetch(presign.uploadUrl, { method: "PUT", headers: presign.headers, body: file });
      await client.completeMedia({ mediaId: presign.mediaId });
      await client.createAudioTrack({
        title: title.trim(),
        artist: artist.trim(),
        mediaId: presign.mediaId,
        durationSeconds,
        mood: mood.trim().length === 0 ? "General" : mood.trim(),
        isActive: true,
      });

      setTitle("");
      setArtist("");
      setMood("");
      setFile(null);
      if (fileRef.current !== null) {
        fileRef.current.value = "";
      }
      await load();
    } catch (error) {
      setState("error");
      setMessage(errorText(error, "Unable to add that soundtrack."));
    }
  }

  async function toggle(track: AudioTrackView): Promise<void> {
    setState("loading");
    try {
      await createAdminApiClient().setAudioTrackActive(track.id, !track.isActive);
      await load();
    } catch (error) {
      setState("error");
      setMessage(errorText(error, "Unable to update that soundtrack."));
    }
  }

  return (
    <Surface state={state} title="Story audio library">
      <p>{message}</p>

      <div style={{ display: "grid", gap: 8, maxWidth: 520, marginBottom: 20 }}>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} />
        </label>
        <label>
          Artist
          <input
            value={artist}
            onChange={(event) => setArtist(event.target.value)}
            maxLength={80}
          />
        </label>
        <label>
          Mood
          <input
            value={mood}
            onChange={(event) => setMood(event.target.value)}
            maxLength={40}
            placeholder="Calm, Festive, Focus…"
          />
        </label>
        <label>
          Audio file
          <input
            ref={fileRef}
            type="file"
            accept="audio/mpeg,audio/mp4,audio/aac,audio/wav"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <Button onClick={() => void add()}>Add soundtrack</Button>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Artist</th>
            <th>Mood</th>
            <th>Length</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((track) => (
            <tr key={track.id}>
              <td>{track.title}</td>
              <td>{track.artist}</td>
              <td>{track.mood}</td>
              <td>{track.durationSeconds}s</td>
              <td>{track.isActive ? "Live" : "Retired"}</td>
              <td>
                <Button onClick={() => void toggle(track)}>
                  {track.isActive ? "Retire" : "Restore"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}
