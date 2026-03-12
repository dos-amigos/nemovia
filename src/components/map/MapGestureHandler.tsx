"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";

/**
 * Disables single-finger map dragging on mobile (requires 2 fingers).
 * Shows a "Usa due dita per spostare la mappa" overlay when user tries single-finger drag.
 * Desktop dragging is unaffected.
 */
export default function MapGestureHandler() {
  const map = useMap();
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const isTouchDevice = "ontouchstart" in window;
    if (!isTouchDevice) return;

    // Disable single-finger dragging on mobile
    map.dragging.disable();

    const container = map.getContainer();
    let hintTimer: ReturnType<typeof setTimeout>;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        map.dragging.enable();
      } else {
        // Single finger — show hint
        setShowHint(true);
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => setShowHint(false), 1500);
      }
    };

    const onTouchEnd = () => {
      map.dragging.disable();
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchend", onTouchEnd);
      clearTimeout(hintTimer);
    };
  }, [map]);

  if (!showHint) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
      <div className="rounded-lg bg-black/70 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
        Usa due dita per spostare la mappa
      </div>
    </div>
  );
}
