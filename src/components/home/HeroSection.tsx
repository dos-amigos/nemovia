"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { FadeIn } from "@/components/animations/FadeIn";
import { CitySearch } from "@/components/home/CitySearch";
import { HERO_VIDEOS, type HeroVideo } from "@/lib/hero-videos";

/** Shuffle array (Fisher-Yates) and return first N items */
function shuffleAndTake(arr: HeroVideo[], n: number): HeroVideo[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

const PLAYLIST_SIZE = 4;

export function HeroSection() {
  const [playlist, setPlaylist] = useState<HeroVideo[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Build a random playlist of 4 videos on mount
  useEffect(() => {
    setPlaylist(shuffleAndTake(HERO_VIDEOS, PLAYLIST_SIZE));
  }, []);

  const video = playlist[currentIdx] ?? null;

  // When a video ends, advance to next in playlist (loop back to 0)
  const handleEnded = useCallback(() => {
    setCurrentIdx((prev) => (prev + 1) % playlist.length);
  }, [playlist.length]);

  // Play video when it changes
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video) return;
    el.load();
    el.play().catch(() => {});
  }, [video]);

  return (
    <FadeIn>
      <section className="relative mx-4 h-[280px] overflow-hidden rounded-2xl sm:mx-6 sm:h-[340px] lg:mx-8 lg:h-[400px]">
        {/* Video background */}
        {video && (
          <video
            ref={videoRef}
            src={video.src}
            autoPlay
            muted
            playsInline
            onEnded={handleEnded}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* Fallback gradient while video loads */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/20" />

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />

        {/* Content overlay */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <h1 className="text-3xl font-bold text-white drop-shadow-lg lg:text-5xl">
            SCOPRI LE SAGRE DEL VENETO
          </h1>
          <p className="mt-3 max-w-lg text-white/80 lg:text-lg">
            Trova sagre ed eventi gastronomici nella tua zona
          </p>
          <CitySearch />
        </div>

        {/* Pexels attribution */}
        {video && (
          <div className="absolute bottom-2 right-3 z-10 text-[10px] text-white/50">
            Video by{" "}
            <a
              href={video.pexelsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white/70"
            >
              {video.photographer}
            </a>{" "}
            on{" "}
            <a
              href="https://www.pexels.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white/70"
            >
              Pexels
            </a>
          </div>
        )}
      </section>
    </FadeIn>
  );
}
