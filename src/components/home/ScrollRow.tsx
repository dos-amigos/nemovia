"use client";

import { useRef, useState, useCallback } from "react";
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
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0, moved: false });

  const scroll = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -300 : 300,
      behavior: "smooth",
    });
  };

  // --- Mouse drag scrolling for desktop ---
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = {
      isDown: true,
      startX: e.pageX - el.offsetLeft,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
    setIsDragging(true);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current.isDown) return;
    e.preventDefault();
    const el = scrollRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = x - dragState.current.startX;
    if (Math.abs(walk) > 5) dragState.current.moved = true;
    el.scrollLeft = dragState.current.scrollLeft - walk;
  }, []);

  const onMouseUp = useCallback(() => {
    dragState.current.isDown = false;
    // Delay clearing isDragging so click events on cards are suppressed during drag
    setTimeout(() => setIsDragging(false), 50);
  }, []);

  return (
    <div className="group relative">
      {/* Scrollable container */}
      <div
        ref={scrollRef}
        role="region"
        tabIndex={0}
        aria-label={ariaLabel}
        className={`scrollbar-hide flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 pl-4 sm:pl-6 lg:pl-[calc(max(2rem,(100vw-80rem)/2+2rem))] scroll-pl-4 sm:scroll-pl-6 lg:scroll-pl-[calc(max(2rem,(100vw-80rem)/2+2rem))] ${isDragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {sagre.map((sagra) => (
          <div
            key={sagra.id}
            className="w-[75vw] flex-shrink-0 snap-start sm:w-[45vw] lg:w-[280px]"
            onClickCapture={(e) => {
              if (dragState.current.moved) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <SagraCard sagra={sagra} />
          </div>
        ))}
        {/* Right padding spacer so last card doesn't stick to edge */}
        <div className="w-4 flex-shrink-0 sm:w-6 lg:w-8" aria-hidden />
      </div>

      {/* Desktop arrow buttons - always visible */}
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
