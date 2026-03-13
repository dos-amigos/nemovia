"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SagraCard } from "@/components/sagra/SagraCard";
import type { SagraCardData } from "@/lib/queries/types";

interface ScrollRowProps {
  sagre: SagraCardData[];
  ariaLabel?: string;
}

export function ScrollRow({ sagre, ariaLabel }: ScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0, totalDelta: 0 });

  // Detect fine pointer (mouse/trackpad) — ONLY enable JS drag on desktop.
  // Mobile: ZERO JS handlers. Pure CSS scroll-snap + native touch.
  const [hasFinePointer, setHasFinePointer] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(pointer: fine)");
    setHasFinePointer(mql.matches);
    const handler = (e: MediaQueryListEvent) => setHasFinePointer(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const scroll = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -300 : 300,
      behavior: "smooth",
    });
  };

  /** Magnetic snap: after drag release, smoothly align nearest card to left edge */
  const snapToNearest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollPadding = parseInt(getComputedStyle(el).scrollPaddingLeft) || 0;
    const scrollPos = el.scrollLeft;
    const children = el.children;

    let bestSnapPoint = scrollPos;
    let bestDist = Infinity;

    // Find the card whose snap point is closest to current scroll position
    for (let i = 0; i < children.length - 1; i++) { // -1 to skip right spacer
      const card = children[i] as HTMLElement;
      const snapPoint = card.offsetLeft - scrollPadding;
      const dist = Math.abs(snapPoint - scrollPos);
      if (dist < bestDist) {
        bestDist = dist;
        bestSnapPoint = snapPoint;
      }
    }

    el.scrollTo({ left: bestSnapPoint, behavior: "smooth" });
  }, []);

  // Desktop-only pointer drag (mouse only)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = scrollRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    drag.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft, totalDelta: 0 };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.clientX - drag.current.startX;
    drag.current.totalDelta = Math.abs(dx);
    if (drag.current.totalDelta > 5) {
      setIsDragging(true);
      el.scrollLeft = drag.current.scrollLeft - dx;
    }
  }, []);

  const onPointerUp = useCallback(() => {
    if (!drag.current.active) return;
    drag.current.active = false;

    // Magnetic snap to nearest card on the left
    if (drag.current.totalDelta > 5) {
      snapToNearest();
    }

    setTimeout(() => {
      setIsDragging(false);
      drag.current.totalDelta = 0;
    }, 100);
  }, [snapToNearest]);

  return (
    <div className="group relative">
      {/* Mobile: pure CSS snap-x + native touch. Desktop: JS drag + magnetic snap + arrows. */}
      <div
        ref={scrollRef}
        role="region"
        tabIndex={0}
        aria-label={ariaLabel}
        className={`scrollbar-hide flex gap-3 overflow-x-auto overscroll-x-contain snap-x snap-mandatory lg:snap-none pb-2 pl-4 sm:pl-6 lg:pl-[calc(max(2rem,(100vw-80rem)/2+2rem))] scroll-pl-4 sm:scroll-pl-6 lg:scroll-pl-[calc(max(2rem,(100vw-80rem)/2+2rem))] ${isDragging ? "cursor-grabbing select-none" : "lg:cursor-grab"}`}
        {...(hasFinePointer ? {
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel: onPointerUp,
        } : {})}
      >
        {sagre.map((sagra) => (
          <div
            key={sagra.id}
            className="w-[75vw] flex-shrink-0 snap-start sm:w-[45vw] lg:w-[280px]"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            {...(hasFinePointer ? {
              onClickCapture: (e: React.MouseEvent) => {
                if (drag.current.totalDelta > 10) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              },
            } : {})}
          >
            <SagraCard sagra={sagra} />
          </div>
        ))}
        {/* Right padding spacer */}
        <div className="w-4 flex-shrink-0 sm:w-6 lg:w-8" aria-hidden="true" />
      </div>

      {/* Desktop arrow buttons */}
      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden lg:block">
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="Scorri a sinistra"
          className="pointer-events-auto absolute left-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 shadow-md backdrop-blur-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="Scorri a destra"
          className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 shadow-md backdrop-blur-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
