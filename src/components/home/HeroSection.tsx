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

/**
 * Build a mixed playlist: local food + API food + city center videos, interleaved.
 * Spreads city/API videos evenly between local food videos for variety.
 */
function buildMixedPlaylist(
  localFoods: HeroVideo[],
  cityVideos: HeroVideo[],
  foodApiVideos: HeroVideo[],
  total: number,
): HeroVideo[] {
  const foods = shuffleAndTake(localFoods, total);
  const extras = [...cityVideos, ...foodApiVideos];

  if (extras.length === 0) return foods.slice(0, total);

  // Shuffle extras (city + food-api) together for variety
  const shuffledExtras = shuffleAndTake(extras, extras.length);

  // Take enough local food videos to fill remaining slots
  const foodCount = total - shuffledExtras.length;
  const selectedFoods = foods.slice(0, Math.max(foodCount, 0));

  // Interleave: food, extra, food, extra, ... (spread extras evenly)
  const result: HeroVideo[] = [];
  let fIdx = 0;
  let eIdx = 0;
  const gap = Math.max(1, Math.floor(total / (shuffledExtras.length + 1)));

  for (let i = 0; i < total; i++) {
    // Insert an extra video at evenly spaced positions
    if (eIdx < shuffledExtras.length && i > 0 && i % gap === 0) {
      result.push(shuffledExtras[eIdx++]);
    } else if (fIdx < selectedFoods.length) {
      result.push(selectedFoods[fIdx++]);
    } else if (eIdx < shuffledExtras.length) {
      result.push(shuffledExtras[eIdx++]);
    }
  }

  // Fill any remaining slots
  while (result.length < total && fIdx < foods.length) {
    result.push(foods[fIdx++]);
  }

  return result.slice(0, total);
}

const PLAYLIST_SIZE = 6;

interface HeroSectionProps {
  /** Veneto city center videos fetched server-side from Pexels */
  cityVideos?: HeroVideo[];
  /** Food-themed videos (wine, beer, grilling) fetched server-side from Pexels */
  foodApiVideos?: HeroVideo[];
}

export function HeroSection({ cityVideos = [], foodApiVideos = [] }: HeroSectionProps) {
  const [playlist, setPlaylist] = useState<HeroVideo[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Build a mixed playlist of local food + API food + city videos on mount
  useEffect(() => {
    setPlaylist(buildMixedPlaylist(HERO_VIDEOS, cityVideos, foodApiVideos, PLAYLIST_SIZE));
  }, [cityVideos, foodApiVideos]);

  const video = playlist[currentIdx] ?? null;

  // When a video ends (or errors), advance to next in playlist (loop back to 0)
  const advanceVideo = useCallback(() => {
    setCurrentIdx((prev) => (prev + 1) % playlist.length);
  }, [playlist.length]);

  // Preload next video so there's no gap between transitions
  useEffect(() => {
    if (playlist.length < 2) return;
    const nextIdx = (currentIdx + 1) % playlist.length;
    const nextSrc = playlist[nextIdx]?.src;
    if (!nextSrc) return;

    // Use a hidden video element to preload — more reliable than <link preload> for video
    const preloader = document.createElement("video");
    preloader.src = nextSrc;
    preloader.preload = "auto";
    preloader.muted = true;
    preloader.load();

    return () => {
      preloader.src = "";
      preloader.load(); // release resources
    };
  }, [currentIdx, playlist]);

  // Play video when it changes
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video) return;
    el.load();
    el.play().catch(() => {});
  }, [video]);

  return (
    <FadeIn>
      <section className="relative mx-4 h-[280px] rounded-2xl sm:mx-6 sm:h-[340px] lg:mx-8 lg:h-[400px]">
        {/* Video + gradients clipped to rounded corners */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          {video && (
            <video
              ref={videoRef}
              src={video.src}
              autoPlay
              muted
              playsInline
              onEnded={advanceVideo}
              onError={advanceVideo}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
        </div>

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
