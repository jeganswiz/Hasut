"use client";

import { Avatar, HasutLogo, nameInitials } from "@hasut/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CHROME_HEIGHT_MAX,
  chromeScrollState,
  type ChromeScrollState,
} from "../lib/discovery-chrome";
import { loginHref, tabSlot, type NavSession } from "../lib/member-nav";
import { webTokenStorage } from "../lib/token-storage";
import { useNavSession } from "./nav-session";
import { NavIcon, type NavIconName } from "./nav-icons";

const LINKS: Array<{ href: string; label: string; icon: NavIconName; auth?: boolean }> = [
  { href: "/", label: "Map", icon: "map" },
  { href: "/live", label: "Live", icon: "live", auth: true },
  { href: "/connections", label: "Connections", icon: "connections", auth: true },
  { href: "/inbox", label: "Inbox", icon: "inbox", auth: true },
  { href: "/notifications", label: "Notifications", icon: "alerts", auth: true },
  { href: "/me", label: "Me", icon: "me", auth: true },
];

export function AppNav() {
  const pathname = usePathname();
  const { session, profile, unread, search } = useNavSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [chrome, setChrome] = useState<ChromeScrollState>({
    height: CHROME_HEIGHT_MAX,
    solid: false,
    progress: 0,
  });

  useEffect(() => {
    function onScroll(): void {
      const map = document.querySelector("[data-map-stage]");
      const mapHeight = map instanceof HTMLElement ? map.getBoundingClientRect().height : 0;
      setChrome(chromeScrollState(window.scrollY, mapHeight));
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  useEffect(() => {
    document.documentElement.style.setProperty("--chrome-height", `${chrome.height}px`);
  }, [chrome.height]);

  const tabs = useMemo(() => {
    const visible: Array<(typeof LINKS)[number] & { slot: "shown" | "reserved" }> = [];
    for (const link of LINKS) {
      const slot = tabSlot(link.auth === true, session);
      if (slot !== "hidden") {
        visible.push({ ...link, slot });
      }
    }
    return visible;
  }, [session]);

  return (
    <>
      <header
        className={chrome.solid ? "app-chrome is-solid" : "app-chrome"}
        style={{ height: chrome.height }}
      >
        <Link className="app-brand" href="/" aria-label="HASUT home">
          <HasutLogo size={28} />
          HASUT
        </Link>
        {search}
        <div className="app-chrome-tools">
          <nav className="app-nav-desktop" aria-label="Member">
            {tabs.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                icon={link.icon}
                slot={link.slot}
                current={
                  link.href === "/"
                    ? pathname === "/"
                    : pathname === link.href || pathname.startsWith(`${link.href}/`)
                }
                badge={badgeFor(link.href, unread.notifications, unread.messages)}
              />
            ))}
          </nav>
          <AccountMenu
            session={session}
            pathname={pathname}
            open={menuOpen}
            photoUrl={profile?.photoUrl ?? null}
            displayName={profile?.displayName ?? ""}
            onToggle={() => setMenuOpen((value) => !value)}
          />
        </div>
      </header>
      <nav
        className="app-tabs"
        aria-label="Member"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, tabs.length)}, minmax(0, 1fr))` }}
      >
        {tabs.map((link) => (
          <NavLink
            key={link.href}
            href={link.href}
            label={link.label}
            icon={link.icon}
            slot={link.slot}
            current={
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`)
            }
            badge={badgeFor(link.href, unread.notifications, unread.messages)}
          />
        ))}
      </nav>
    </>
  );
}

function badgeFor(href: string, notifications: number, messages: number): number {
  if (href === "/notifications") {
    return notifications;
  }
  if (href === "/inbox") {
    return messages;
  }
  return 0;
}

function NavLink({
  href,
  label,
  icon,
  current,
  badge,
  slot,
}: {
  href: string;
  label: string;
  icon: NavIconName;
  current: boolean;
  badge: number;
  slot: "shown" | "reserved";
}) {
  const inner = (
    <>
      <NavIcon name={icon} />
      {badge > 0 ? <span className="nav-badge">{badge > 9 ? "9+" : badge}</span> : null}
    </>
  );
  if (slot === "reserved") {
    return (
      <span
        className="nav-icon is-reserved"
        data-nav-slot="reserved"
        aria-hidden="true"
        title={label}
      >
        {inner}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="nav-icon"
      data-nav-slot="shown"
      aria-label={label}
      aria-current={current ? "page" : undefined}
      title={label}
    >
      {inner}
    </Link>
  );
}

function AccountMenu({
  session,
  pathname,
  open,
  photoUrl,
  displayName,
  onToggle,
}: {
  session: NavSession;
  pathname: string;
  open: boolean;
  photoUrl: string | null;
  displayName: string;
  onToggle: () => void;
}) {
  if (session !== "member") {
    if (session === "unknown") {
      return <span className="nav-account-slot hasut-skeleton" aria-hidden="true" />;
    }
    return (
      <Link className="nav-icon" href={loginHref(pathname)} aria-label="Sign in" title="Sign in">
        <NavIcon name="sign-in" />
      </Link>
    );
  }
  return (
    <div className="nav-account">
      <button
        type="button"
        className="nav-profile"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onToggle}
      >
        <Avatar
          photoUrl={photoUrl}
          initials={nameInitials(displayName)}
          size={32}
          label={displayName}
        />
        <span className="nav-profile-name">{displayName}</span>
      </button>
      {open ? (
        <div className="nav-menu" role="menu">
          <Link href="/story" role="menuitem">
            <NavIcon name="story" /> Presence story
          </Link>
          <Link href="/support" role="menuitem">
            <NavIcon name="support" /> Support
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void webTokenStorage.clear().then(() => {
                window.location.assign("/");
              });
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function NavSearchSlot({ children }: { children: ReactNode }) {
  const { setSearch } = useNavSession();
  useEffect(() => {
    setSearch(children);
    return () => setSearch(null);
  }, [children, setSearch]);
  return null;
}
