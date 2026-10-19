"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  PULL_REFRESH_THRESHOLD,
  prefersReducedMotion,
  pullDistance,
  shouldTriggerRefresh,
} from "../lib/pull-refresh";

export function PullToRefresh({
  onRefresh,
  disabled = false,
  children,
}: {
  onRefresh: () => Promise<void>;
  disabled?: boolean;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pullRef = useRef(0);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (root === null || disabled) {
      return;
    }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (prefersReducedMotion(motion)) {
      return;
    }
    let tracking = false;
    let startY = 0;

    const atTop = (): boolean => {
      const scroller = document.scrollingElement;
      const windowTop = scroller === null ? window.scrollY === 0 : scroller.scrollTop <= 0;
      return windowTop && root.scrollTop <= 0;
    };

    const onStart = (event: TouchEvent) => {
      if (refreshing || event.touches.length !== 1) {
        return;
      }
      const touch = event.touches[0];
      if (touch === undefined || !atTop()) {
        return;
      }
      tracking = true;
      startY = touch.clientY;
    };

    const onMove = (event: TouchEvent) => {
      if (!tracking || event.touches.length !== 1) {
        return;
      }
      const touch = event.touches[0];
      if (touch === undefined) {
        return;
      }
      const distance = Math.min(96, pullDistance(startY, touch.clientY, atTop()));
      pullRef.current = distance;
      setPull(distance);
    };

    const onEnd = () => {
      if (!tracking) {
        return;
      }
      tracking = false;
      const distance = pullRef.current;
      pullRef.current = 0;
      setPull(0);
      if (!shouldTriggerRefresh(distance, atTop())) {
        return;
      }
      setRefreshing(true);
      void onRefresh().finally(() => setRefreshing(false));
    };

    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: true });
    root.addEventListener("touchend", onEnd);
    root.addEventListener("touchcancel", onEnd);
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
    };
  }, [disabled, onRefresh, refreshing]);

  return (
    <div ref={rootRef} className="ptr-root">
      <div
        className="ptr-indicator"
        style={{ height: refreshing ? 36 : pull }}
        aria-hidden={true}
        data-refreshing={refreshing ? "true" : "false"}
      >
        {refreshing ? "Refreshing…" : pull >= PULL_REFRESH_THRESHOLD ? "Release" : ""}
      </div>
      {children}
    </div>
  );
}
