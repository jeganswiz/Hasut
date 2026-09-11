"use client";

import { HasutApiError } from "@hasut/api-client";
import type { NotificationView, UnreadCountView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "../../components/app-nav";
import { createWebApiClient } from "../../lib/api";
import "../social.css";

export default function NotificationsPage() {
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading notifications…");
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unread, setUnread] = useState<UnreadCountView | null>(null);

  const load = useCallback(async () => {
    try {
      const [feed, counts] = await Promise.all([
        createWebApiClient().listNotifications(),
        createWebApiClient().getUnreadCount(),
      ]);
      setItems(feed);
      setUnread(counts);
      setState(feed.length === 0 ? "empty" : "success");
      setMessage(
        feed.length === 0
          ? "No notifications yet."
          : `${counts.notifications} unread notifications · ${counts.messages} unread messages`,
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load notifications.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <AppNav />
      <h1>Notifications</h1>
      <Surface state={state} title="Activity">
        <p>{message}</p>
        {unread !== null && unread.notifications > 0 ? (
          <Button
            variant="secondary"
            onClick={() => {
              void createWebApiClient().markAllNotificationsRead().then(load);
            }}
          >
            Mark all read
          </Button>
        ) : null}
        <div className="stack">
          {items.map((item) => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              {item.readAt === null ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    void createWebApiClient().markNotificationRead(item.id).then(load);
                  }}
                >
                  Mark read
                </Button>
              ) : null}
            </article>
          ))}
        </div>
      </Surface>
    </main>
  );
}
