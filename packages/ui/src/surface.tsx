import type { CSSProperties, ReactNode } from "react";
import { cssVar } from "./tokens";

export type SurfaceState = "loading" | "empty" | "error" | "success";

export interface SurfaceProps {
  state: SurfaceState;
  title: string;
  children: ReactNode;
}

export function Surface({ state, title, children }: SurfaceProps) {
  const style: CSSProperties = {
    background: cssVar("surface"),
    color: cssVar("text"),
    border: `1px solid ${cssVar("border")}`,
    borderRadius: cssVar("cardRadius"),
    padding: 20,
    transition: "border-color 200ms ease, box-shadow 200ms ease",
  };

  return (
    <section style={style} data-state={state}>
      <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{title}</h2>
      <div style={{ color: state === "error" ? cssVar("danger") : cssVar("mutedText") }}>
        {children}
      </div>
    </section>
  );
}
