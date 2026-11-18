"use client";

import { useEffect } from "react";

/**
 * Mobile browsers still trigger double-tap zoom on some interactive surfaces
 * even with `user-scalable=no`. This kills the second tap of a double tap so
 * the page never ends up stuck at 2×. Elements that need their own gestures
 * (the map, form fields) opt out via `data-allow-zoom` or their tag name.
 */
export function ZoomGuard() {
  useEffect(() => {
    let last = 0;
    const onTouchEnd = (event: TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "[data-allow-zoom], .maplibregl-map, .maplibregl-canvas, input, textarea, select, [contenteditable='true']",
        )
      ) {
        last = 0;
        return;
      }
      const now = Date.now();
      if (now - last < 320 && event.cancelable) event.preventDefault();
      last = now;
    };
    document.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => document.removeEventListener("touchend", onTouchEnd);
  }, []);
  return null;
}
