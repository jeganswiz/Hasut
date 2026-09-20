"use client";

import { HasutLogo } from "@hasut/ui";
import { useEffect, useState } from "react";
import { createWebApiClient } from "../lib/api";

const TABS = [
  { href: "/", label: "Map" },
  { href: "/connections", label: "Connections" },
  { href: "/inbox", label: "Inbox" },
  { href: "/notifications", label: "Alerts" },
  { href: "/me", label: "Me" },
] as const;

export function AppNav() {
  const [unread, setUnread] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    void createWebApiClient()
      .theme()
      .then((theme) => setLogoUrl(theme.logoUrl))
      .catch(() => setLogoUrl(null));
    void createWebApiClient()
      .getUnreadCount()
      .then((data) => setUnread(data.notifications + data.messages))
      .catch(() => setUnread(0));
  }, []);

  return (
    <>
      <header className="app-chrome">
        <a className="app-brand" href="/">
          <HasutLogo src={logoUrl} />
          <span>HASUT</span>
        </a>
        <nav className="app-nav-desktop" aria-label="Primary">
          {TABS.map((tab) => (
            <a key={tab.href} href={tab.href}>
              {tab.label}
              {tab.href === "/notifications" && unread > 0 ? ` (${unread})` : ""}
            </a>
          ))}
          <a href="/story">Story</a>
          <a href="/support">Support</a>
          <a href="/login">Sign in</a>
        </nav>
      </header>
      <nav className="app-tabs" aria-label="Member">
        {TABS.map((tab) => (
          <a key={tab.href} href={tab.href}>
            {tab.label}
            {tab.href === "/notifications" && unread > 0 ? ` (${unread})` : ""}
          </a>
        ))}
      </nav>
    </>
  );
}
