"use client";

import { HasutApiError } from "@hasut/api-client";
import type { ConversationView } from "@hasut/types";
import { Surface, type SurfaceState } from "@hasut/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PullToRefresh } from "../../../components/pull-to-refresh";
import { createWebApiClient } from "../../../lib/api";
import { isUnauthenticated, redirectToLogin } from "../../../lib/member-nav";
import { readVisit, VISIT_KEYS, writeVisit } from "../../../lib/visit-cache";

interface InboxVisit {
  items: ConversationView[];
  message: string;
  state: SurfaceState;
}

export default function InboxPage() {
  const cached = readVisit<InboxVisit>(VISIT_KEYS.inbox);
  const [state, setState] = useState<SurfaceState>(cached?.state ?? "loading");
  const [message, setMessage] = useState(cached?.message ?? "Loading conversations…");
  const [items, setItems] = useState<ConversationView[]>(cached?.items ?? []);

  const load = useCallback(async () => {
    try {
      const data = await createWebApiClient().listConversations();
      const nextState: SurfaceState = data.length === 0 ? "empty" : "success";
      const nextMessage =
        data.length === 0 ? "No conversations yet." : `${data.length} conversations`;
      setItems(data);
      setState(nextState);
      setMessage(nextMessage);
      writeVisit(VISIT_KEYS.inbox, { items: data, message: nextMessage, state: nextState });
    } catch (error: unknown) {
      if (isUnauthenticated(error)) {
        redirectToLogin("/inbox");
        return;
      }
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load inbox.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PullToRefresh onRefresh={load}>
      <main>
        <h1>Inbox</h1>
        <Surface state={state} title="Messages">
          <p>{message}</p>
          <div className="stack">
            {items.map((item) => (
              <article key={item.id}>
                <Link href={`/conversations/${item.id}`}>
                  <strong>{item.peer.displayName}</strong>
                </Link>
                <p>{item.lastMessage?.body ?? item.lastMessage?.type ?? "No messages yet"}</p>
                {item.unreadCount > 0 ? <p>{item.unreadCount} unread</p> : null}
              </article>
            ))}
          </div>
        </Surface>
      </main>
    </PullToRefresh>
  );
}
