"use client";

import { HasutApiError, createHasutRealtimeClient } from "@hasut/api-client";
import { resolveRealtimeApiBaseUrl } from "@hasut/config";
import type { ConversationView, MessageView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "../../../components/app-nav";
import { createWebApiClient } from "../../../lib/api";
import { webTokenStorage } from "../../../lib/token-storage";
import "../../social.css";

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading chat…");
  const [conversation, setConversation] = useState<ConversationView | null>(null);
  const [items, setItems] = useState<MessageView[]>([]);
  const [draft, setDraft] = useState("");
  const [selfId, setSelfId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const client = createWebApiClient();
    const [thread, page, me] = await Promise.all([
      client.getConversation(conversationId),
      client.listMessages(conversationId),
      client.me(),
    ]);
    setConversation(thread);
    setItems(page.items);
    setSelfId(me.id);
    setState(page.items.length === 0 ? "empty" : "success");
    setMessage(thread.peer.displayName);
    const last = page.items[page.items.length - 1];
    if (last !== undefined) {
      await client.markMessagesRead(conversationId, last.id);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadHistory().catch((error: unknown) => {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load this chat.");
    });
    const realtime = createHasutRealtimeClient({
      baseUrl: resolveRealtimeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL, window.location.origin),
      tokenStorage: webTokenStorage,
    });
    void realtime.connect().then((socket) => {
      socket.on("connect", () => {
        void loadHistory();
      });
      socket.on("message.created", (payload: unknown) => {
        if (isMessageView(payload) && payload.conversationId === conversationId) {
          setItems((current) =>
            current.some((item) => item.id === payload.id) ? current : [...current, payload],
          );
          setState("success");
          void createWebApiClient().markMessagesRead(conversationId, payload.id);
        }
      });
      socket.on("message.read", () => {
        void loadHistory();
      });
    });
    return () => realtime.disconnect();
  }, [conversationId, loadHistory]);

  async function sendText(): Promise<void> {
    if (draft.trim().length === 0) {
      return;
    }
    try {
      const created = await createWebApiClient().sendMessage(conversationId, {
        type: "TEXT",
        body: draft.trim(),
      });
      setDraft("");
      setItems((current) => [...current, created]);
      setState("success");
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to send.");
    }
  }

  async function sendImage(file: File): Promise<void> {
    try {
      const client = createWebApiClient();
      const presign = await client.presignMedia({
        purpose: "CHAT",
        mimeType: file.type,
        byteSize: file.size,
      });
      await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: presign.headers,
        body: file,
      });
      const ready = await client.completeMedia({ mediaId: presign.mediaId });
      const created = await client.sendMessage(conversationId, {
        type: "IMAGE",
        mediaId: ready.id,
      });
      setItems((current) => [...current, created]);
      setState("success");
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to send image.");
    }
  }

  return (
    <main>
      <AppNav />
      <h1>{conversation?.peer.displayName ?? "Chat"}</h1>
      <Surface state={state} title="Conversation">
        <p>{message}</p>
        <div className="thread">
          {items.map((item) => (
            <div key={item.id} className={item.senderId === selfId ? "bubble mine" : "bubble"}>
              {item.type === "IMAGE" && item.mediaUrl !== null ? (
                <img src={item.mediaUrl} alt="" />
              ) : (
                <p>{item.body}</p>
              )}
              <p className="read-status">{item.readAt === null ? "Sent" : "Read"}</p>
            </div>
          ))}
        </div>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void sendText();
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message"
          />
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) {
                void sendImage(file);
              }
            }}
          />
          <Button type="submit">Send</Button>
        </form>
      </Surface>
    </main>
  );
}

function isMessageView(value: unknown): value is MessageView {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.conversationId === "string";
}
