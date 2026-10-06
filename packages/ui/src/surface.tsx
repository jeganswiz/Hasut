import type { CSSProperties, ReactNode } from "react";
import { cssVar } from "./tokens";

export type SurfaceState = "loading" | "empty" | "error" | "success";

export interface SurfaceProps {
  state: SurfaceState;
  title: string;
  children: ReactNode;
  /** Lines for a page, cards for a row of results. */
  skeleton?: "lines" | "cards";
}

export function Surface({ state, title, children, skeleton = "lines" }: SurfaceProps) {
  const style: CSSProperties = {
    background: cssVar("surface"),
    color: cssVar("text"),
    border: `1px solid ${cssVar("border")}`,
    borderRadius: cssVar("cardRadius"),
    padding: 20,
    position: "relative",
    transition: "border-color 200ms ease, box-shadow 200ms ease",
  };

  return (
    <section style={style} data-state={state} aria-busy={state === "loading"}>
      <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{title}</h2>
      {state === "loading" ? (
        <>
          <Skeleton kind={skeleton} />
          <div
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
            }}
          >
            {children}
          </div>
        </>
      ) : (
        <div style={{ color: state === "error" ? cssVar("danger") : cssVar("mutedText") }}>
          {children}
        </div>
      )}
    </section>
  );
}

function Skeleton({ kind }: { kind: "lines" | "cards" }) {
  if (kind === "cards") {
    return (
      <div aria-hidden="true" style={{ display: "flex", gap: 12 }}>
        {[0, 1, 2].map((item) => (
          <span
            key={item}
            className="hasut-skeleton"
            style={{ flex: 1, height: 120, borderRadius: 12 }}
          />
        ))}
      </div>
    );
  }
  return (
    <div aria-hidden="true" style={{ display: "grid", gap: 10 }}>
      {[100, 92, 70].map((width) => (
        <span
          key={width}
          className="hasut-skeleton"
          style={{ display: "block", height: 12, width: `${width}%`, borderRadius: 999 }}
        />
      ))}
    </div>
  );
}
