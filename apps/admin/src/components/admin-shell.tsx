"use client";

import { HasutLogo } from "@hasut/ui";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { adminTokenStorage } from "../lib/token-storage";

export type AdminSection =
  | "overview"
  | "members"
  | "professionals"
  | "businesses"
  | "categories"
  | "discovery"
  | "verification"
  | "reports"
  | "stories"
  | "story-audio"
  | "support"
  | "theme"
  | "flags"
  | "templates"
  | "audit"
  | "login";

interface NavItem {
  href: string;
  id: AdminSection;
  label: string;
  group: string;
  roles?: Array<"ADMIN" | "SUPPORT_AGENT" | "MODERATOR">;
}

const NAV: NavItem[] = [
  { href: "/", id: "overview", label: "Dashboard", group: "Operations" },
  { href: "/members", id: "members", label: "Members", group: "People", roles: ["ADMIN"] },
  {
    href: "/professionals",
    id: "professionals",
    label: "Professionals",
    group: "People",
    roles: ["ADMIN"],
  },
  { href: "/businesses", id: "businesses", label: "Businesses", group: "People", roles: ["ADMIN"] },
  {
    href: "/categories",
    id: "categories",
    label: "Categories",
    group: "Catalog",
    roles: ["ADMIN"],
  },
  { href: "/discovery", id: "discovery", label: "Discovery", group: "Catalog", roles: ["ADMIN"] },
  {
    href: "/verification",
    id: "verification",
    label: "Verification",
    group: "Trust",
    roles: ["ADMIN"],
  },
  {
    href: "/reports",
    id: "reports",
    label: "Reports",
    group: "Trust",
    roles: ["ADMIN", "MODERATOR"],
  },
  {
    href: "/stories",
    id: "stories",
    label: "Stories",
    group: "Trust",
    roles: ["ADMIN", "MODERATOR"],
  },
  {
    href: "/stories/audio",
    id: "story-audio",
    label: "Story audio",
    group: "Trust",
    roles: ["ADMIN", "MODERATOR"],
  },
  {
    href: "/support",
    id: "support",
    label: "Support",
    group: "Support",
    roles: ["ADMIN", "SUPPORT_AGENT"],
  },
  { href: "/theme", id: "theme", label: "Theme", group: "Configuration", roles: ["ADMIN"] },
  { href: "/flags", id: "flags", label: "Flags", group: "Configuration", roles: ["ADMIN"] },
  {
    href: "/templates",
    id: "templates",
    label: "Templates",
    group: "Configuration",
    roles: ["ADMIN"],
  },
  { href: "/audit", id: "audit", label: "Audit", group: "Configuration", roles: ["ADMIN"] },
];

export function AdminShell({
  section,
  title,
  lede,
  children,
}: {
  section: AdminSection;
  title: string;
  lede: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [roleLabel, setRoleLabel] = useState("Guest");
  const [roles, setRoles] = useState<string[]>([]);
  const [appearance, setAppearance] = useState("standard");

  useEffect(() => {
    const stored = window.localStorage.getItem("hasut-admin-appearance");
    if (stored === "high-contrast") {
      setAppearance(stored);
      document.documentElement.dataset.appearance = stored;
    }
    void (async () => {
      const token = await adminTokenStorage.getAccessToken();
      if (token === null) {
        return;
      }
      try {
        const me = await createAdminApiClient().me();
        setRoles(me.roles);
        setRoleLabel(me.roles.includes("ADMIN") ? "Admin" : (me.roles[0] ?? "Member"));
      } catch {
        setRoleLabel("Guest");
      }
    })();
  }, []);

  const visible = NAV.filter((item) => {
    if (item.roles === undefined) {
      return true;
    }
    return roles.includes("ADMIN") || item.roles.some((role) => roles.includes(role));
  });
  const groups = [...new Set(visible.map((item) => item.group))];

  async function logout(): Promise<void> {
    try {
      await createAdminApiClient().logout();
    } catch {
      /* still clear local session */
    }
    await adminTokenStorage.clear();
    window.location.assign("/login");
  }

  return (
    <div className={collapsed ? "admin-app is-collapsed" : "admin-app"}>
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          <HasutLogo />
          {collapsed ? null : <span>HASUT</span>}
        </a>
        <nav aria-label="Admin">
          {groups.map((group) => (
            <div key={group} className="admin-nav-group">
              {collapsed ? null : <p className="admin-nav-label">{group}</p>}
              {visible
                .filter((item) => item.group === group)
                .map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    className={item.id === section ? "is-active" : undefined}
                    aria-current={item.id === section ? "page" : undefined}
                  >
                    {item.label}
                  </a>
                ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-icon-btn"
            onClick={() => setCollapsed((value) => !value)}
          >
            Menu
          </button>
          <form
            className="admin-search"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const q = String(data.get("q") ?? "");
              window.location.assign(`/members?q=${encodeURIComponent(q)}`);
            }}
          >
            <input name="q" placeholder="Search members" aria-label="Search members" />
          </form>
          <button
            type="button"
            className="admin-icon-btn"
            onClick={() => {
              const next = appearance === "standard" ? "high-contrast" : "standard";
              setAppearance(next);
              document.documentElement.dataset.appearance = next;
              window.localStorage.setItem("hasut-admin-appearance", next);
            }}
          >
            {appearance === "high-contrast" ? "Standard" : "Contrast"}
          </button>
          <span className="admin-role">{roleLabel}</span>
          <a href="/login">Sign in</a>
          <button type="button" className="admin-icon-btn" onClick={() => void logout()}>
            Log out
          </button>
        </header>
        <main>
          <header className="admin-page-head">
            <p className="admin-kicker">{section}</p>
            <h1>{title}</h1>
            <p className="lede">{lede}</p>
          </header>
          <div className="admin-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
