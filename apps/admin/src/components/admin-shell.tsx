import type { ReactNode } from "react";

export type AdminSection = "overview" | "categories" | "discovery" | "login";

const NAV: Array<{ href: string; id: AdminSection; label: string }> = [
  { href: "/", id: "overview", label: "Overview" },
  { href: "/categories", id: "categories", label: "Categories" },
  { href: "/discovery", id: "discovery", label: "Discovery" },
  { href: "/login", id: "login", label: "Sign in" },
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
  return (
    <div className="admin-app">
      <header className="admin-chrome">
        <a className="admin-brand" href="/">
          HASUT
        </a>
        <nav className="admin-nav" aria-label="Admin">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className={item.id === section ? "is-active" : undefined}
              aria-current={item.id === section ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main>
        <header className="admin-page-head">
          <p className="admin-kicker">Operations</p>
          <h1>{title}</h1>
          <p className="lede">{lede}</p>
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
