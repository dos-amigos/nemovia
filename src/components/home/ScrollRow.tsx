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
  const dragState = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
    animId: 0,
  });

  const scroll = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -300 : 300,
      behavior: "smooth",
    });
  };

  // --- Mouse drag scrolling for desktop (smooth, no snap during drag) ---
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    // Disable snap during drag for fluid motion
    el.style.scrollSnapType = "none";
    dragState.current = {
      isDown: true,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
      animId: 0,
    };
    setIsDragging(true);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current.isDown) return;
    e.preventDefault();
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.clientX - dragState.current.startX;
    if (Math.abs(dx) > 5) dragState.current.moved = true;
    el.scrollLeft = dragState.current.scrollLeft - dx;
  }, []);

  const stopDrag = useCallback(() => {
    if (!dragState.current.isDown) return;
    dragState.current.isDown = false;
    const el = scrollRef.current;
    if (el) {
      // Re-enable snap after drag ends
      el.style.scrollSnapType = "";
    }
    setTimeout(() => setIsDragging(false), 50);
  }, []);

  // Cleanup: if mouse leaves window mid-drag
  useEffect(() => {
    const handleUp = () => stopDrag();
    window.addEventListener("mouseup", handleUp);
    return () => window.removeEventListener("mouseup", handleUp);
  }, [stopDrag]);

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
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
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
