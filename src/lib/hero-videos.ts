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
 * Curated hero videos — EMPTY until manually verified.
 * ALL local food videos removed because they could not be verified
 * and at least one contained chopsticks/Asian food.
 * The hero now relies ONLY on Pexels API city + food videos (which ARE filtered).
 * To re-add local videos: download, WATCH THEM, verify NO Asian food, then add here.
 */
export const HERO_VIDEOS: HeroVideo[] = [];

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

// =============================================================================
// REGOLA TASSATIVA: NO CIBO ORIENTALE — filtra via video con sushi/bacchette/asian
// Pexels ignora i filtri negativi (-asian -sushi), serve filtro lato codice
// =============================================================================
const BANNED_VIDEO_KEYWORDS = /sushi|chopstick|asian|chinese|japanese|ramen|wok|noodle|dim.?sum|tofu|soy.?sauce|kimchi|thai|vietnamese|korean|oriental|bento|miso|teriyaki|tempura|gyoza|edamame|wasabi|sashimi|udon|pho|curry|pad.?thai|spring.?roll|dumpling|stir.?fry|bok.?choy|szechuan|cantonese|mandarin|sake|matcha/i;

function isAsianFoodVideo(video: PexelsVideo): boolean {
  // Check video URL slug (Pexels URLs contain description)
  if (BANNED_VIDEO_KEYWORDS.test(video.url)) return true;
  // Check video tags
  const tagText = video.tags?.map((t) => t.name).filter(Boolean).join(" ") ?? "";
  if (BANNED_VIDEO_KEYWORDS.test(tagText)) return true;
  return false;
}

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
  tags?: Array<{ name?: string }>;
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
    // TASSATIVO: filter out any Asian/oriental food videos
    const safeVideos = data.videos.filter((v) => !isAsianFoodVideo(v));
    if (safeVideos.length === 0) return null;

    // Pick a random video from safe results
    const video = safeVideos[Math.floor(Math.random() * safeVideos.length)];

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
        const safeVideos = data.videos.filter((v) => !isAsianFoodVideo(v));
        if (safeVideos.length === 0) return null;

        const video =
          safeVideos[Math.floor(Math.random() * safeVideos.length)];

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
        const safeVideos = data.videos.filter((v) => !isAsianFoodVideo(v));
        if (safeVideos.length === 0) return null;

        const video =
          safeVideos[Math.floor(Math.random() * safeVideos.length)];

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
