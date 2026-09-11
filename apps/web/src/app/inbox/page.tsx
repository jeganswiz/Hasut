"use client";

import { HasutApiError } from "@hasut/api-client";
import type { ConversationView } from "@hasut/types";
import { Surface, type SurfaceState } from "@hasut/ui";
import { useEffect, useState } from "react";
import { AppNav } from "../../components/app-nav";
import { createWebApiClient } from "../../lib/api";
import "../social.css";

export default function InboxPage() {
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading conversations…");
  const [items, setItems] = useState<ConversationView[]>([]);

  useEffect(() => {
    void createWebApiClient()
      .listConversations()
      .then((data) => {
        setItems(data);
        setState(data.length === 0 ? "empty" : "success");
        setMessage(data.length === 0 ? "No conversations yet." : `${data.length} conversations`);
      })
      .catch((error: unknown) => {
        setState("error");
        setMessage(error instanceof HasutApiError ? error.message : "Unable to load inbox.");
      });
  }, []);

  return (
    <main>
      <AppNav />
      <h1>Inbox</h1>
      <Surface state={state} title="Messages">
        <p>{message}</p>
        <div className="stack">
          {items.map((item) => (
            <article key={item.id}>
              <a href={`/conversations/${item.id}`}>
                <strong>{item.peer.displayName}</strong>
              </a>
              <p>{item.lastMessage?.body ?? item.lastMessage?.type ?? "No messages yet"}</p>
              {item.unreadCount > 0 ? <p>{item.unreadCount} unread</p> : null}
            </article>
          ))}
        </div>
      </Surface>
    </main>
  );
}
