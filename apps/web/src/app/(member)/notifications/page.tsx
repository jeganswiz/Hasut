"use client";

import { HasutApiError } from "@hasut/api-client";
import type { NotificationView, UnreadCountView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { PullToRefresh } from "../../../components/pull-to-refresh";
import { createWebApiClient } from "../../../lib/api";
import { isUnauthenticated, redirectToLogin } from "../../../lib/member-nav";
import { readVisit, VISIT_KEYS, writeVisit } from "../../../lib/visit-cache";

interface NotificationsVisit {
  items: NotificationView[];
  unread: UnreadCountView | null;
  message: string;
  state: SurfaceState;
}

export default function NotificationsPage() {
  const cached = readVisit<NotificationsVisit>(VISIT_KEYS.notifications);
  const [state, setState] = useState<SurfaceState>(cached?.state ?? "loading");
  const [message, setMessage] = useState(cached?.message ?? "Loading notifications…");
  const [items, setItems] = useState<NotificationView[]>(cached?.items ?? []);
  const [unread, setUnread] = useState<UnreadCountView | null>(cached?.unread ?? null);

  const load = useCallback(async () => {
    try {
      const [feed, counts] = await Promise.all([
        createWebApiClient().listNotifications(),
        createWebApiClient().getUnreadCount(),
      ]);
      const nextState: SurfaceState = feed.length === 0 ? "empty" : "success";
      const nextMessage =
        feed.length === 0
          ? "No notifications yet."
          : `${counts.notifications} unread notifications · ${counts.messages} unread messages`;
      setItems(feed);
      setUnread(counts);
      setState(nextState);
      setMessage(nextMessage);
      writeVisit(VISIT_KEYS.notifications, {
        items: feed,
        unread: counts,
        message: nextMessage,
        state: nextState,
      });
    } catch (error) {
      if (isUnauthenticated(error)) {
        redirectToLogin("/notifications");
        return;
      }
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load notifications.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PullToRefresh onRefresh={load}>
      <main>
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
        <NotificationPrefs />
      </main>
    </PullToRefresh>
  );
}

function NotificationPrefs() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [max, setMax] = useState("20");
  const [note, setNote] = useState("");

  useEffect(() => {
    void createWebApiClient()
      .getNotificationSettings()
      .then((settings) => {
        setStart(
          settings.quietHoursStartMinutes === null ? "" : String(settings.quietHoursStartMinutes),
        );
        setEnd(settings.quietHoursEndMinutes === null ? "" : String(settings.quietHoursEndMinutes));
        setMax(String(settings.maxPerHour));
      })
      .catch(() => undefined);
  }, []);

  return (
    <Surface state="success" title="Quiet hours">
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void createWebApiClient()
            .updateNotificationSettings({
              quietHoursStartMinutes: start.length === 0 ? null : Number(start),
              quietHoursEndMinutes: end.length === 0 ? null : Number(end),
              maxPerHour: Number(max),
            })
            .then(() => setNote("Saved."))
            .catch((error: unknown) => {
              setNote(error instanceof HasutApiError ? error.message : "Unable to save settings.");
            });
        }}
      >
        <label>
          Quiet start (minutes from midnight UTC)
          <input value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label>
          Quiet end
          <input value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
        <label>
          Max notifications per hour
          <input value={max} onChange={(event) => setMax(event.target.value)} />
        </label>
        <Button type="submit" variant="secondary">
          Save notification settings
        </Button>
        {note.length > 0 ? <p>{note}</p> : null}
      </form>
    </Surface>
  );
}
