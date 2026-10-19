import type { ReactNode } from "react";
import { AppNav } from "../../components/app-nav";
import "../social.css";

export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <AppNav />
      {children}
    </div>
  );
}
