import type { ReactNode } from "react";
import { Card, CardTitle } from "./components/card";
import { Skeleton } from "./components/skeleton";
import { cn } from "./lib/utils";

export type SurfaceState = "loading" | "empty" | "error" | "success";

export interface SurfaceProps {
  state: SurfaceState;
  title: string;
  children: ReactNode;
  /** Lines for a page, cards for a row of results. */
  skeleton?: "lines" | "cards";
}

export function Surface({ state, title, children, skeleton = "lines" }: SurfaceProps) {
  return (
    <Card data-state={state} aria-busy={state === "loading"} className="relative p-5">
      <CardTitle className="mb-2">{title}</CardTitle>
      {state === "loading" ? (
        <>
          <LoadingSkeleton kind={skeleton} />
          <div className="absolute h-px w-px overflow-hidden [clip:rect(0_0_0_0)]">{children}</div>
        </>
      ) : (
        <div className={cn(state === "error" ? "text-destructive" : "text-muted-foreground")}>
          {children}
        </div>
      )}
    </Card>
  );
}

function LoadingSkeleton({ kind }: { kind: "lines" | "cards" }) {
  if (kind === "cards") {
    return (
      <div aria-hidden="true" className="flex gap-3">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="h-28 flex-1" />
        ))}
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="grid gap-2.5">
      {[100, 92, 70].map((width) => (
        <Skeleton key={width} className="h-3 rounded-full" style={{ width: `${width}%` }} />
      ))}
    </div>
  );
}
