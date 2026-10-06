"use client";

import { HasutApiError } from "@hasut/api-client";
import type { ConnectionView, StoryViewerEntry } from "@hasut/types";
import { useEffect, useState, type FormEvent } from "react";
import { createWebApiClient } from "../../lib/api";

export function StoryActions({
  storyId,
  ownerId,
  viewerId,
}: {
  storyId: string;
  ownerId: string;
  viewerId: string | null;
}) {
  if (viewerId === null) {
    return null;
  }
  if (viewerId === ownerId) {
    return <OwnerActivity storyId={storyId} />;
  }
  return <GuestActivity storyId={storyId} />;
}

function OwnerActivity({ storyId }: { storyId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [viewers, setViewers] = useState<StoryViewerEntry[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    setOpen(false);
    setState("idle");
    setViewers([]);
  }, [storyId]);

  function load(): void {
    setOpen(true);
    setState("loading");
    void createWebApiClient()
      .listStoryViewers(storyId)
      .then((list) => {
        setViewers(list.viewers);
        setState("ready");
        setNote(list.viewers.length === 0 ? "No one has viewed this yet." : "");
      })
      .catch((error: unknown) => {
        setState("error");
        setNote(error instanceof HasutApiError ? error.message : "Unable to load viewers.");
      });
  }

  return (
    <>
      <div className="story-actions">
        <button type="button" className="story-viewers-open" onClick={load}>
          <EyeIcon />
          Viewed by
        </button>
      </div>
      {open ? (
        <section className="story-sheet" aria-label="Viewed by">
          <h2>Viewed by</h2>
          {state === "loading" ? <p className="story-note">Loading viewers…</p> : null}
          {state === "error" || note.length > 0 ? <p className="story-note">{note}</p> : null}
          {state === "ready"
            ? viewers.map((entry) => (
                <div className="story-sheet-row" key={entry.member.id}>
                  {entry.member.photoUrl !== null ? (
                    <img src={entry.member.photoUrl} alt="" />
                  ) : (
                    <span className="story-sheet-mark">{mark(entry.member.displayName)}</span>
                  )}
                  <span>{entry.member.displayName}</span>
                  {entry.liked ? (
                    <span className="story-sheet-like" aria-label="Liked">
                      <HeartIcon filled />
                    </span>
                  ) : null}
                </div>
              ))
            : null}
        </section>
      ) : null}
    </>
  );
}

function GuestActivity({ storyId }: { storyId: string }) {
  const [text, setText] = useState("");
  const [liked, setLiked] = useState(false);
  const [note, setNote] = useState("");
  const [sharing, setSharing] = useState(false);
  const [people, setPeople] = useState<ConnectionView[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [shareState, setShareState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    setText("");
    setNote("");
    setSharing(false);
    setLiked(false);
    const client = createWebApiClient();
    void client
      .storyLikeState(storyId)
      .then((state) => setLiked(state.liked))
      .catch(() => undefined);
  }, [storyId]);

  function reply(event: FormEvent): void {
    event.preventDefault();
    const body = text.trim();
    if (body.length === 0) {
      return;
    }
    setNote("");
    void createWebApiClient()
      .replyToStory(storyId, body)
      .then(() => {
        setText("");
        setNote("Sent");
      })
      .catch((error: unknown) => {
        setNote(error instanceof HasutApiError ? error.message : "Unable to send that message.");
      });
  }

  function like(): void {
    void createWebApiClient()
      .toggleStoryLike(storyId)
      .then((state) => setLiked(state.liked))
      .catch((error: unknown) => {
        setNote(error instanceof HasutApiError ? error.message : "Unable to update the like.");
      });
  }

  function openShare(): void {
    setSharing(true);
    setShareState("loading");
    setPicked([]);
    void createWebApiClient()
      .listConnections()
      .then((rows) => {
        setPeople(rows.filter((row) => row.status === "ACCEPTED"));
        setShareState("ready");
      })
      .catch((error: unknown) => {
        setShareState("error");
        setNote(error instanceof HasutApiError ? error.message : "Unable to load connections.");
      });
  }

  function sendShare(): void {
    if (picked.length === 0) {
      return;
    }
    void createWebApiClient()
      .shareStory(storyId, picked)
      .then((result) => {
        setSharing(false);
        setNote(result.sent === 1 ? "Shared" : `Shared with ${result.sent}`);
      })
      .catch((error: unknown) => {
        setNote(error instanceof HasutApiError ? error.message : "Unable to share this presence.");
      });
  }

  return (
    <>
      <form className="story-actions" onSubmit={reply}>
        <input
          className="story-reply"
          value={text}
          placeholder="Send message"
          aria-label="Send message"
          onChange={(event) => setText(event.target.value)}
        />
        <button
          type="button"
          className={`story-action${liked ? " is-liked" : ""}`}
          aria-label={liked ? "Unlike" : "Like"}
          aria-pressed={liked}
          onClick={like}
        >
          <HeartIcon filled={liked} />
        </button>
        <button type="button" className="story-action" aria-label="Share" onClick={openShare}>
          <ShareIcon />
        </button>
      </form>
      {note.length > 0 ? <p className="story-note">{note}</p> : null}
      {sharing ? (
        <section className="story-sheet" aria-label="Share presence">
          <h2>Share</h2>
          {shareState === "loading" ? <p className="story-note">Loading connections…</p> : null}
          {shareState === "ready" && people.length === 0 ? (
            <p className="story-note">Connect with someone before sharing a presence.</p>
          ) : null}
          {shareState === "ready"
            ? people.map((row) => {
                const on = picked.includes(row.peer.id);
                return (
                  <button
                    key={row.peer.id}
                    type="button"
                    className="story-sheet-row"
                    aria-pressed={on}
                    onClick={() =>
                      setPicked((current) =>
                        current.includes(row.peer.id)
                          ? current.filter((id) => id !== row.peer.id)
                          : [...current, row.peer.id],
                      )
                    }
                  >
                    {row.peer.photoUrl !== null ? (
                      <img src={row.peer.photoUrl} alt="" />
                    ) : (
                      <span className="story-sheet-mark">{mark(row.peer.displayName)}</span>
                    )}
                    <span>{row.peer.displayName}</span>
                    <span className="story-sheet-like" aria-hidden="true">
                      {on ? "✓" : ""}
                    </span>
                  </button>
                );
              })
            : null}
          {shareState === "ready" && people.length > 0 ? (
            <button type="button" className="story-viewers-open" onClick={sendShare}>
              Send
            </button>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function mark(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
  return letters.length > 0 ? letters : "?";
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9Z"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 4 10 13" />
      <path d="m21 4-7 17-4-7-7-4 18-6Z" />
    </svg>
  );
}
