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
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0, totalDelta: 0, pointerId: 0, captured: false });
  const isSnapping = useRef(false);

  // Detect fine pointer (mouse/trackpad) — ONLY enable JS drag on desktop.
  // Mobile: native touch scroll, no JS handlers.
  const [hasFinePointer, setHasFinePointer] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(pointer: fine)");
    setHasFinePointer(mql.matches);
    const handler = (e: MediaQueryListEvent) => setHasFinePointer(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  /** Magnetic snap: smoothly align nearest card to left edge of visible area */
  const snapToNearest = useCallback(() => {
    const el = scrollRef.current;
    if (!el || isSnapping.current) return;

    const containerLeft = el.getBoundingClientRect().left;
    const paddingLeft = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const targetLeft = containerLeft + paddingLeft;

    const children = Array.from(el.children);
    // Exclude the last child (right padding spacer)
    const cards = children.slice(0, -1);

    let bestOffset = 0;
    let bestDist = Infinity;

    for (const child of cards) {
      const cardLeft = (child as HTMLElement).getBoundingClientRect().left;
      const offset = cardLeft - targetLeft;
      const dist = Math.abs(offset);
      if (dist < bestDist) {
        bestDist = dist;
        bestOffset = offset;
      }
    }

    // Already aligned — skip
    if (bestDist < 2) return;

    isSnapping.current = true;
    el.scrollTo({ left: el.scrollLeft + bestOffset, behavior: "smooth" });
    setTimeout(() => { isSnapping.current = false; }, 400);
  }, []);

  // Scroll-end snap for ALL devices: after scroll momentum stops, align to nearest card.
  // No CSS snap needed — pure JS gives smooth native scroll + guaranteed alignment.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;

    const onScroll = () => {
      // Don't interfere while actively dragging or already snapping
      if (drag.current.active || isSnapping.current) return;
      clearTimeout(timer);
      timer = setTimeout(snapToNearest, 150);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [snapToNearest]);

  /** Scroll arrows: jump to next/previous card position */
  const scrollToCard = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;

    const containerLeft = el.getBoundingClientRect().left;
    const paddingLeft = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const targetLeft = containerLeft + paddingLeft;
    const cards = Array.from(el.children).slice(0, -1);

    if (direction === "right") {
      // Find first card whose left edge is to the right of the current view
      for (const child of cards) {
        const cardLeft = (child as HTMLElement).getBoundingClientRect().left;
        if (cardLeft > targetLeft + 10) {
          const offset = cardLeft - targetLeft;
          isSnapping.current = true;
          el.scrollTo({ left: el.scrollLeft + offset, behavior: "smooth" });
          setTimeout(() => { isSnapping.current = false; }, 400);
          return;
        }
      }
    } else {
      // Find last card whose left edge is to the left of the current view
      for (let i = cards.length - 1; i >= 0; i--) {
        const cardLeft = (cards[i] as HTMLElement).getBoundingClientRect().left;
        if (cardLeft < targetLeft - 10) {
          const offset = cardLeft - targetLeft;
          isSnapping.current = true;
          el.scrollTo({ left: el.scrollLeft + offset, behavior: "smooth" });
          setTimeout(() => { isSnapping.current = false; }, 400);
          return;
        }
      }
    }
  }, []);

  // Desktop-only pointer drag (mouse only)
  // CRITICAL: setPointerCapture is DELAYED until 5px drag movement.
  // Calling it on pointerdown steals clicks from <Link> children.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = scrollRef.current;
    if (!el) return;
    drag.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft, totalDelta: 0, pointerId: e.pointerId, captured: false };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.clientX - drag.current.startX;
    drag.current.totalDelta = Math.abs(dx);
    if (drag.current.totalDelta > 5) {
      // Capture ONLY after drag threshold — before this, clicks reach Link children
      if (!drag.current.captured) {
        el.setPointerCapture(drag.current.pointerId);
        drag.current.captured = true;
      }
      setIsDragging(true);
      el.scrollLeft = drag.current.scrollLeft - dx;
    }
  }, []);

  const onPointerUp = useCallback(() => {
    if (!drag.current.active) return;
    drag.current.active = false;

    // Magnetic snap to nearest card on release
    if (drag.current.totalDelta > 5) {
      snapToNearest();
    }

    setTimeout(() => {
      setIsDragging(false);
      drag.current.totalDelta = 0;
      drag.current.captured = false;
    }, 100);
  }, [snapToNearest]);

  return (
    <div className="group relative">
      {/* No CSS scroll-snap — pure JS snap after scroll end for ALL devices.
          Mobile: smooth native touch scroll + JS alignment at end.
          Desktop: JS drag + magnetic snap + arrows. */}
      <div
        ref={scrollRef}
        role="region"
        tabIndex={0}
        aria-label={ariaLabel}
        className={`scrollbar-hide flex gap-3 overflow-x-auto overscroll-x-contain pb-2 pl-4 sm:pl-6 lg:pl-[calc(max(2rem,(100vw-80rem)/2+2rem))] ${isDragging ? "cursor-grabbing select-none" : "lg:cursor-grab"}`}
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
            className="w-[75vw] flex-shrink-0 sm:w-[45vw] lg:w-[280px]"
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
          onClick={() => scrollToCard("left")}
          aria-label="Scorri a sinistra"
          className="pointer-events-auto absolute left-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 shadow-md backdrop-blur-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => scrollToCard("right")}
          aria-label="Scorri a destra"
          className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 shadow-md backdrop-blur-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
