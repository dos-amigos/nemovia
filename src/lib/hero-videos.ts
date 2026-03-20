// =============================================================================
// Hero video metadata for the landing page
// Local videos downloaded from Pexels (free license) served from /public/videos/
// City center videos fetched at build/request time via Pexels Video API
// =============================================================================

export interface HeroVideo {
  /** URL or path to the video file */
  src: string;
  /** Name of the Pexels photographer/videographer */
  photographer: string;
  /** Link to the original video on Pexels */
  pexelsUrl: string;
  /** "food" = curated local videos, "city" = Veneto cities, "food-api" = Pexels food API */
  type: "food" | "city" | "food-api";
}

/**
 * Curated hero videos — Italian food, cooking, vineyards, markets, festivals.
 * All videos are landscape, 720p, 5-24s, under 5MB each.
 */
export const HERO_VIDEOS: HeroVideo[] = [
  {
    src: "/videos/hero-3.mp4",
    photographer: "cottonbro studio",
    pexelsUrl: "https://www.pexels.com/video/4253150/",
    type: "food",
  },
  {
    src: "/videos/hero-4.mp4",
    photographer: "Klaus Nielsen",
    pexelsUrl: "https://www.pexels.com/video/6288312/",
    type: "food",
  },
  {
    src: "/videos/hero-5.mp4",
    photographer: "Kelly",
    pexelsUrl: "https://www.pexels.com/video/19905400/",
    type: "food",
  },
  {
    src: "/videos/hero-6.mp4",
    photographer: "Klaus Nielsen",
    pexelsUrl: "https://www.pexels.com/video/6281185/",
    type: "food",
  },
  {
    src: "/videos/hero-7.mp4",
    photographer: "Devilishly Good",
    pexelsUrl: "https://www.pexels.com/video/5372095/",
    type: "food",
  },
];

// =============================================================================
// Veneto city center video queries for Pexels API
// Descriptive landmark-based queries — NEVER just a city name alone
// =============================================================================

export const VENETO_CITY_QUERIES = [
  "Padova Prato della Valle aerial",
  "Verona arena piazza",
  "Venezia canal grande gondola",
  "Vicenza piazza dei signori",
  "Treviso centro storico river",
  "Bassano del Grappa ponte vecchio",
  "Venezia piazza San Marco",
  "Verona ponte pietra river",
  "Padova basilica Sant Antonio",
  "Chioggia fishing boats canal",
  "Burano colorful houses Venice",
  "Asolo hilltop village Veneto",
] as const;

// =============================================================================
// Food-themed video queries for Pexels API
// Italian/Mediterranean food preparation — wine, beer, grilling
// =============================================================================

export const FOOD_VIDEO_QUERIES = [
  "pouring red wine Italian vineyard -asian -sushi",
  "Italian pizza wood oven -asian -chopsticks",
  "pasta making fresh Italian kitchen -asian -ramen",
  "Italian cheese prosciutto cutting -asian -sushi",
  "olive oil pouring Mediterranean bread -asian -chopsticks",
  "Italian outdoor food market vegetables -asian -chinese",
] as const;

interface PexelsVideoFile {
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideo {
  id: number;
  url: string;
  user: { name: string };
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  videos: PexelsVideo[];
}

/**
 * Fetch a random Veneto city center video from Pexels.
 * Returns a HeroVideo or null if API unavailable.
 * Called server-side with 24h cache (revalidate).
 */
export async function fetchCityVideo(): Promise<HeroVideo | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  // Pick a random city query
  const query =
    VENETO_CITY_QUERIES[
      Math.floor(Math.random() * VENETO_CITY_QUERIES.length)
    ];

  // Fetch up to 5 results and pick one at random for variety
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5&size=small&orientation=landscape`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      next: { revalidate: 86400 }, // Cache 24h
    });

    if (!res.ok) return null;

    const data: PexelsSearchResponse = await res.json();
    if (data.videos.length === 0) return null;

    // Pick a random video from results
    const video = data.videos[Math.floor(Math.random() * data.videos.length)];

    // Prefer HD mp4 <= 1280px wide, fallback to SD
    const hdFile = video.video_files.find(
      (f) =>
        f.quality === "hd" &&
        f.file_type === "video/mp4" &&
        f.width <= 1280,
    );
    const sdFile = video.video_files.find(
      (f) => f.quality === "sd" && f.file_type === "video/mp4",
    );

    const file = hdFile ?? sdFile;
    if (!file?.link) return null;

    return {
      src: file.link,
      photographer: video.user.name,
      pexelsUrl: video.url,
      type: "city",
    };
  } catch {
    return null;
  }
}

/**
 * Fetch multiple unique city videos from Pexels.
 * Uses different queries for each to maximize variety.
 */
export async function fetchCityVideos(count: number): Promise<HeroVideo[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];

  // Shuffle queries and take `count` of them
  const shuffled = [...VENETO_CITY_QUERIES]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);

  const results = await Promise.allSettled(
    shuffled.map(async (query): Promise<HeroVideo | null> => {
      const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=3&size=small&orientation=landscape`;

      try {
        const res = await fetch(url, {
          headers: { Authorization: apiKey! },
          next: { revalidate: 86400 },
        });

        if (!res.ok) return null;

        const data: PexelsSearchResponse = await res.json();
        if (data.videos.length === 0) return null;

        const video =
          data.videos[Math.floor(Math.random() * data.videos.length)];

        const hdFile = video.video_files.find(
          (f) =>
            f.quality === "hd" &&
            f.file_type === "video/mp4" &&
            f.width <= 1280,
        );
        const sdFile = video.video_files.find(
          (f) => f.quality === "sd" && f.file_type === "video/mp4",
        );

        const file = hdFile ?? sdFile;
        if (!file?.link) return null;

        return {
          src: file.link,
          photographer: video.user.name,
          pexelsUrl: video.url,
          type: "city",
        };
      } catch {
        return null;
      }
    }),
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<HeroVideo> =>
        r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value);
}

/**
 * Fetch food-themed videos from Pexels (wine, beer, grilling).
 * Uses FOOD_VIDEO_QUERIES for Italian/Mediterranean food content.
 */
export async function fetchFoodVideos(count: number): Promise<HeroVideo[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];

  // Shuffle queries and take `count` of them
  const shuffled = [...FOOD_VIDEO_QUERIES]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);

  const results = await Promise.allSettled(
    shuffled.map(async (query): Promise<HeroVideo | null> => {
      const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=3&size=small&orientation=landscape`;

      try {
        const res = await fetch(url, {
          headers: { Authorization: apiKey! },
          next: { revalidate: 86400 },
        });

        if (!res.ok) return null;

        const data: PexelsSearchResponse = await res.json();
        if (data.videos.length === 0) return null;

        const video =
          data.videos[Math.floor(Math.random() * data.videos.length)];

        const hdFile = video.video_files.find(
          (f) =>
            f.quality === "hd" &&
            f.file_type === "video/mp4" &&
            f.width <= 1280,
        );
        const sdFile = video.video_files.find(
          (f) => f.quality === "sd" && f.file_type === "video/mp4",
        );

        const file = hdFile ?? sdFile;
        if (!file?.link) return null;

        return {
          src: file.link,
          photographer: video.user.name,
          pexelsUrl: video.url,
          type: "food-api",
        };
      } catch {
        return null;
      }
    }),
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<HeroVideo> =>
        r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value);
}

/**
 * Pick a random hero video index (0-based).
 * Called server-side so the initial render already knows which video to play.
 */
export function getRandomVideoIndex(): number {
  return Math.floor(Math.random() * HERO_VIDEOS.length);
}
