// =============================================================================
// Hero video metadata for the landing page
// Videos downloaded from Pexels (free license) and served from /public/videos/
// =============================================================================

export interface HeroVideo {
  /** Path to the local video file, e.g. "/videos/hero-1.mp4" */
  src: string;
  /** Name of the Pexels photographer/videographer */
  photographer: string;
  /** Link to the original video on Pexels */
  pexelsUrl: string;
}

/**
 * Curated hero videos — Italian food, cooking, vineyards, markets, festivals.
 * All videos are landscape, 720p, 5-24s, under 5MB each.
 */
export const HERO_VIDEOS: HeroVideo[] = [
  {
    src: "/videos/hero-1.mp4",
    photographer: "Nazim Zafri",
    pexelsUrl: "https://www.pexels.com/video/3525952/",
  },
  {
    src: "/videos/hero-2.mp4",
    photographer: "Kelly",
    pexelsUrl: "https://www.pexels.com/video/2941127/",
  },
  {
    src: "/videos/hero-3.mp4",
    photographer: "cottonbro studio",
    pexelsUrl: "https://www.pexels.com/video/4253150/",
  },
  {
    src: "/videos/hero-4.mp4",
    photographer: "Klaus Nielsen",
    pexelsUrl: "https://www.pexels.com/video/6288312/",
  },
  {
    src: "/videos/hero-5.mp4",
    photographer: "Kelly",
    pexelsUrl: "https://www.pexels.com/video/19905400/",
  },
  {
    src: "/videos/hero-6.mp4",
    photographer: "Klaus Nielsen",
    pexelsUrl: "https://www.pexels.com/video/6281185/",
  },
  {
    src: "/videos/hero-7.mp4",
    photographer: "Devilishly Good",
    pexelsUrl: "https://www.pexels.com/video/5372095/",
  },
];

/**
 * Pick a random hero video index (0-based).
 * Called server-side so the initial render already knows which video to play.
 */
export function getRandomVideoIndex(): number {
  return Math.floor(Math.random() * HERO_VIDEOS.length);
}
