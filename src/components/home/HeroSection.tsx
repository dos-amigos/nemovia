"use client";

import { useRef, useState, useEffect } from "react";
import { FadeIn } from "@/components/animations/FadeIn";
import { CitySearch } from "@/components/home/CitySearch";
import { HERO_VIDEOS, type HeroVideo } from "@/lib/hero-videos";

export function HeroSection() {
  // Random video on every mount (= every page refresh)
  const [video, setVideo] = useState<HeroVideo | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const idx = Math.floor(Math.random() * HERO_VIDEOS.length);
    setVideo(HERO_VIDEOS[idx]);
  }, []);

  // Ensure playback starts even if autoplay is delayed
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video) return;
    el.play().catch(() => {
      // Autoplay blocked — the poster frame is still visible
    });
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
            loop
            muted
            playsInline
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
