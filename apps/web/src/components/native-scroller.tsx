"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Horizontal strip that pans like a native scroller: hidden scrollbar,
 * touch momentum, and pointer drag on desktop.
 */
export function NativeScroller({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) {
      return;
    }
    let tracking = false;
    let moved = false;
    let startX = 0;
    let startScroll = 0;
    let pointerId = -1;

    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) {
        return;
      }
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey;
      if (!horizontal) {
        return;
      }
      const delta =
        event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX || event.deltaY;
      el.scrollLeft += delta;
      event.preventDefault();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.button !== 0) {
        return;
      }
      tracking = true;
      moved = false;
      startX = event.clientX;
      startScroll = el.scrollLeft;
      pointerId = event.pointerId;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!tracking || event.pointerId !== pointerId) {
        return;
      }
      const dx = event.clientX - startX;
      if (!moved && Math.abs(dx) < 5) {
        return;
      }
      if (!moved) {
        moved = true;
        el.classList.add("is-dragging");
        el.setPointerCapture(event.pointerId);
      }
      el.scrollLeft = startScroll - dx;
    };

    const endDrag = (event: PointerEvent) => {
      if (!tracking || event.pointerId !== pointerId) {
        return;
      }
      tracking = false;
      el.classList.remove("is-dragging");
      if (!moved) {
        return;
      }
      const stopClick = (click: Event) => {
        click.preventDefault();
        click.stopPropagation();
        el.removeEventListener("click", stopClick, true);
      };
      el.addEventListener("click", stopClick, true);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  const classNames = className === undefined ? "native-scroll-x" : `native-scroll-x ${className}`;
  return (
    <div ref={ref} className={classNames} role="group" aria-label={label}>
      {children}
    </div>
  );
}
