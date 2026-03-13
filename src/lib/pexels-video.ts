const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

interface PexelsVideoFile {
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideo {
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  videos: PexelsVideo[];
}

/**
 * Extract a theme keyword from the sagra title for video search.
 * "Sagra di Primavera a Borgo Veneto" → "spring Italy"
 * "Sagra dei Broccoli" → "broccoli market Italy"
 * "Festa dell'Olio" → "olive oil Italy"
 */
const TITLE_THEMES: [RegExp, string][] = [
  [/primavera/i, "spring flowers countryside Italy"],
  [/estate|ferragosto/i, "summer Italian countryside"],
  [/autunno/i, "autumn harvest Italy"],
  [/inverno|natale/i, "winter Italian village"],
  [/broccol/i, "broccoli vegetable market"],
  [/asparag/i, "asparagus vegetable market"],
  [/carciofo|carciofi/i, "artichoke food market"],
  [/radicchio/i, "radicchio salad Italian"],
  [/zucca|zucch/i, "pumpkin autumn market"],
  [/fungh/i, "mushroom forest Italy"],
  [/pesce|mare|frutti/i, "seafood fish market Italy"],
  [/carne|grigliata|salsicc/i, "grilled meat barbecue Italy"],
  [/olio|oliv/i, "olive oil food Italy"],
  [/vino|vendemmia|uva/i, "wine vineyard Italy"],
  [/formaggio|formaggi|caseus/i, "cheese Italian market"],
  [/dolci|torta|frittella|pinz/i, "Italian pastry sweets"],
  [/gnocch/i, "gnocchi pasta Italian food"],
  [/polenta/i, "polenta Italian food"],
  [/baccalà|baccala/i, "stockfish Italian food"],
  [/risotto|riso/i, "risotto Italian food"],
];

function extractThemeQuery(title: string, foodTags?: string[] | null): string | null {
  // Check title for specific themes
  for (const [pattern, query] of TITLE_THEMES) {
    if (pattern.test(title)) return query;
  }
  // Check food tags
  if (foodTags?.length) {
    const tag = foodTags[0];
    const foodQueries: Record<string, string> = {
      Pesce: "seafood fish market Italy",
      Carne: "grilled meat barbecue Italy",
      Vino: "wine vineyard Italy",
      Formaggi: "cheese Italian market",
      Funghi: "mushroom autumn Italy",
      Radicchio: "radicchio Italian vegetable",
      Dolci: "Italian pastry sweets bakery",
      Zucca: "pumpkin autumn market",
    };
    if (foodQueries[tag]) return foodQueries[tag];
  }
  return null;
}

/**
 * Search Pexels for a video matching the sagra's theme.
 * Priority: sagra theme (from title/food) → city → province → generic Veneto.
 * Returns a direct video URL (mp4) or null.
 */
export async function searchCityVideo(
  locationText: string,
  province?: string | null,
  title?: string,
  foodTags?: string[] | null,
): Promise<string | null> {
  if (!PEXELS_API_KEY) return null;

  const cityName = extractCityName(locationText);
  const themeQuery = title ? extractThemeQuery(title, foodTags) : null;

  const queries = [
    themeQuery,                                    // Theme/food first
    `${cityName} Italy`,                           // City fallback
    province ? `${province} Italy` : null,         // Province fallback
    "Veneto Italy countryside",                    // Generic fallback
  ].filter(Boolean) as string[];

  for (const query of queries) {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&size=small&orientation=landscape`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: PEXELS_API_KEY },
        next: { revalidate: 86400 }, // Cache 24h
      });

      if (!res.ok) continue;

      const data: PexelsSearchResponse = await res.json();
      if (data.videos.length === 0) continue;

      const video = data.videos[0];
      // Prefer HD mp4 ≤ 1280px wide, fallback to SD
      const hdFile = video.video_files.find(
        (f) =>
          f.quality === "hd" &&
          f.file_type === "video/mp4" &&
          f.width <= 1280
      );
      const sdFile = video.video_files.find(
        (f) => f.quality === "sd" && f.file_type === "video/mp4"
      );

      const file = hdFile ?? sdFile;
      if (file?.link) return file.link;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Extract city name from location_text.
 * "Zugliano (VI)" → "Zugliano"
 * "San Bonifacio" → "San Bonifacio"
 */
export function extractCityName(locationText: string): string {
  return locationText.replace(/\s*\([^)]+\)\s*$/, "").trim();
}
