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
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });

  const scroll = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -300 : 300,
      behavior: "smooth",
    });
  };

  // --- Mouse drag (desktop only — touch uses native scroll) ---
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only handle mouse, not touch (touch has native momentum)
    if (e.pointerType !== "mouse") return;
    const el = scrollRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    drag.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft, moved: false };
    setIsDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current.active || e.pointerType !== "mouse") return;
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 3) drag.current.moved = true;
    el.scrollLeft = drag.current.scrollLeft - dx;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!drag.current.active || e.pointerType !== "mouse") return;
    drag.current.active = false;
    setTimeout(() => setIsDragging(false), 50);
  }, []);

  return (
    <div className="group relative">
      {/* Scrollable container — snap only on touch (mobile), not desktop */}
      <div
        ref={scrollRef}
        role="region"
        tabIndex={0}
        aria-label={ariaLabel}
        className={`scrollbar-hide flex gap-3 overflow-x-auto pb-2 pl-4 sm:pl-6 lg:pl-[calc(max(2rem,(100vw-80rem)/2+2rem))] snap-x snap-mandatory lg:snap-none scroll-pl-4 sm:scroll-pl-6 ${isDragging ? "cursor-grabbing select-none" : "lg:cursor-grab"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: "pan-x" }}
      >
        {sagre.map((sagra) => (
          <div
            key={sagra.id}
            className="w-[75vw] flex-shrink-0 snap-start sm:w-[45vw] lg:w-[280px]"
            onClickCapture={(e) => {
              if (drag.current.moved) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <SagraCard sagra={sagra} />
          </div>
        ))}
        {/* Right padding spacer */}
        <div className="w-4 flex-shrink-0 sm:w-6 lg:w-8" aria-hidden />
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
