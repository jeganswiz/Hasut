"use client";

import type { OwnerMemberProfile } from "@hasut/types";
import { Avatar, HasutLogo } from "@hasut/ui";
import { initialsFromName } from "@hasut/utils";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createWebApiClient } from "../lib/api";
import {
  CHROME_HEIGHT_MAX,
  chromeScrollState,
  type ChromeScrollState,
} from "../lib/discovery-chrome";
import { loadNavProfile } from "../lib/session-profile";
import { webTokenStorage } from "../lib/token-storage";
import { NavIcon, type NavIconName } from "./nav-icons";

const LINKS: Array<{ href: string; label: string; icon: NavIconName; tab?: boolean }> = [
  { href: "/", label: "Map", icon: "map", tab: true },
  { href: "/connections", label: "Connections", icon: "connections", tab: true },
  { href: "/inbox", label: "Inbox", icon: "inbox", tab: true },
  { href: "/notifications", label: "Alerts", icon: "alerts", tab: true },
  { href: "/me", label: "Me", icon: "me", tab: true },
  { href: "/story", label: "Story", icon: "story" },
  { href: "/support", label: "Support", icon: "support" },
];

export function AppNav() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [profile, setProfile] = useState<OwnerMemberProfile | null>(null);
  const [session, setSession] = useState<"unknown" | "guest" | "member">("unknown");
  const [chrome, setChrome] = useState<ChromeScrollState>({
    height: CHROME_HEIGHT_MAX,
    solid: false,
    progress: 0,
  });

  useEffect(() => {
    void createWebApiClient()
      .theme()
      .then((theme) => setLogoUrl(theme.logoUrl))
      .catch(() => setLogoUrl(null));
    void createWebApiClient()
      .getUnreadCount()
      .then((data) => setUnread(data.notifications + data.messages))
      .catch(() => setUnread(0));
    void loadNavProfile({
      getAccessToken: () => webTokenStorage.getAccessToken(),
      getRefreshToken: () => webTokenStorage.getRefreshToken(),
      readProfile: () => createWebApiClient().getMyProfile(),
      refresh: async (refreshToken) => {
        const tokens = await createWebApiClient().refresh({ refreshToken });
        return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
      },
      save: (tokens) => webTokenStorage.setSession(tokens),
    }).then((next) => {
      setProfile(next);
      setSession(next === null ? "guest" : "member");
    });
  }, []);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      const stage = document.querySelector("[data-map-stage]");
      const mapHeight = stage instanceof HTMLElement ? stage.offsetHeight : 0;
      const next = chromeScrollState(window.scrollY, mapHeight);
      setChrome(next);
      document.documentElement.style.setProperty("--chrome-height", `${next.height}px`);
    };
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const account =
    session === "member" && profile !== null ? (
      <a className="nav-profile" href="/me" aria-label={`${profile.displayName} profile`}>
        <Avatar
          photoUrl={profile.photoUrl}
          initials={initialsFromName(profile.displayName)}
          size={32}
          label={profile.displayName}
        />
        <span className="nav-profile-name">{profile.displayName}</span>
      </a>
    ) : (
      <a
        className="nav-icon"
        href="/login"
        aria-label="Sign in"
        title="Sign in"
        aria-current={pathname === "/login" ? "page" : undefined}
      >
        <NavIcon name="sign-in" />
      </a>
    );

  return (
    <>
      <header
        className={chrome.solid ? "app-chrome is-solid" : "app-chrome"}
        style={{ height: chrome.height }}
      >
        <a className="app-brand" href="/" aria-label="HASUT home">
          <HasutLogo src={logoUrl} />
          <span>HASUT</span>
        </a>
        <div className="app-chrome-tools">
          <nav className="app-nav-desktop" aria-label="Primary">
            {LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                icon={link.icon}
                current={isCurrent(pathname, link.href)}
                unread={link.href === "/notifications" ? unread : 0}
              />
            ))}
          </nav>
          <div className="app-nav-account">
            {session === "unknown" ? (
              <span className="nav-account-slot" aria-hidden="true" />
            ) : (
              account
            )}
          </div>
        </div>
      </header>
      <nav className="app-tabs" aria-label="Member">
        {LINKS.filter((link) => link.tab === true).map((link) => (
          <NavLink
            key={link.href}
            href={link.href}
            label={link.label}
            icon={link.icon}
            current={isCurrent(pathname, link.href)}
            unread={link.href === "/notifications" ? unread : 0}
          />
        ))}
      </nav>
    </>
  );
}

function NavLink({
  href,
  label,
  icon,
  current,
  unread,
}: {
  href: string;
  label: string;
  icon: NavIconName;
  current: boolean;
  unread: number;
}) {
  const badge = unread > 0 ? (unread > 9 ? "9+" : String(unread)) : null;
  return (
    <a
      className="nav-icon"
      href={href}
      aria-label={badge === null ? label : `${label}, ${unread} unread`}
      title={label}
      aria-current={current ? "page" : undefined}
    >
      <NavIcon name={icon} />
      {badge !== null ? <span className="nav-badge">{badge}</span> : null}
    </a>
  );
}

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
