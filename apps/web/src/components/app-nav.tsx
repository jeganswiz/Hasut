"use client";

import { useEffect, useState } from "react";
import { createWebApiClient } from "../lib/api";

export function AppNav() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    void createWebApiClient()
      .getUnreadCount()
      .then((data) => setUnread(data.notifications + data.messages))
      .catch(() => setUnread(0));
  }, []);

  return (
    <nav className="app-nav">
      <a href="/">Map</a>
      <a href="/connections">Connections</a>
      <a href="/inbox">Inbox</a>
      <a href="/notifications">Notifications{unread > 0 ? ` (${unread})` : ""}</a>
      <a href="/login">Sign in</a>
    </nav>
  );
}
