"use client";

import type { LiveChatMessageView, LiveSessionView } from "@hasut/types";
import { Button, TextField } from "@hasut/ui";
import { useState } from "react";

const REACTIONS = ["👏", "🔥", "❤️", "🎉"];

export function LiveChatPanel({
  live,
  messages,
  pinned,
  canModerate,
  onSend,
  onReact,
  onPin,
  onHide,
}: {
  live: LiveSessionView;
  messages: LiveChatMessageView[];
  pinned: LiveChatMessageView | null;
  canModerate: boolean;
  onSend: (body: string) => Promise<void>;
  onReact: (emoji: string) => void;
  onPin: (messageId: string | null) => void;
  onHide: (messageId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    const body = draft.trim();
    if (body.length === 0 || busy) {
      return;
    }
    setBusy(true);
    try {
      await onSend(body);
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  if (!live.chatEnabled) {
    return <p className="hint">Chat is off for this live.</p>;
  }

  return (
    <section className="lv-chat" aria-label="Live chat">
      {pinned === null ? null : (
        <p className="lv-pin">
          Pinned · {pinned.member.displayName}: {pinned.body}{" "}
          {canModerate ? (
            <button type="button" className="lv-link" onClick={() => onPin(null)}>
              Unpin
            </button>
          ) : null}
        </p>
      )}
      <ol className="lv-chat-list">
        {messages.length === 0 ? <li className="hint">No messages yet.</li> : null}
        {messages.map((message) => (
          <li key={message.id}>
            <strong>
              {message.member.displayName}
              {message.isHost
                ? " · Host"
                : message.isModerator
                  ? " · Mod"
                  : message.isPatron
                    ? " · Patron"
                    : ""}
            </strong>
            <span>{message.body}</span>
            {canModerate ? (
              <span className="lv-chat-tools">
                <button type="button" className="lv-link" onClick={() => onPin(message.id)}>
                  Pin
                </button>
                <button type="button" className="lv-link" onClick={() => onHide(message.id)}>
                  Hide
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="lv-react" role="group" aria-label="Reactions">
        {REACTIONS.map((emoji) => (
          <button key={emoji} type="button" className="lv-react-btn" onClick={() => onReact(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
      <form
        className="lv-chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label="Message"
          value={draft}
          onChange={setDraft}
          placeholder={live.chatPatronsOnly ? "Patrons chat" : "Say something"}
          disabled={busy}
        />
        <Button type="submit" disabled={busy || draft.trim().length === 0}>
          {busy ? "Sending…" : "Send"}
        </Button>
      </form>
    </section>
  );
}
