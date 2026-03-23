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
 * Extract a food theme from the sagra title for video search.
 * NEVER searches by city name — always food/subject.
 */
const TITLE_THEMES: [RegExp, string][] = [
  // Specific foods first
  [/birr[ae]/i, "craft beer pouring glass"],
  [/radicchio/i, "radicchio red chicory salad"],
  [/asparag/i, "asparagus green cooking"],
  [/carciofo|carciofi/i, "artichoke cooking Italian"],
  [/broccol/i, "broccoli cooking vegetables"],
  [/polenta/i, "polenta Italian corn cooking"],
  [/baccalà|baccala|stoccafisso/i, "cod fish cooking Italian"],
  [/salsicc/i, "sausage grilling Italian"],
  [/castagne|castagna|marroni/i, "roasting chestnuts fire autumn"],
  [/mele\b|mela\b|pomo\b|pero\b/i, "fresh apples harvest"],
  [/fragol/i, "fresh strawberries red"],
  [/ciliegi[ae]/i, "fresh cherries red"],
  [/risotto/i, "risotto cooking Italian rice"],
  [/bufal/i, "mozzarella fresh Italian cheese"],
  [/\boca\b|dell.oca/i, "roasted poultry dinner"],
  [/pinza|pinzin|focaccia/i, "focaccia bread baking Italian"],
  [/scarpetta/i, "bread dipping sauce Italian"],
  [/\bolio\b|oliv/i, "olive oil pouring Italian food"],
  [/bigol|bigui/i, "fresh pasta Italian making"],
  [/cinghiale/i, "meat stew Italian cooking"],
  [/somarino|\basino\b/i, "grilled meat barbecue Italian"],
  [/piselli|\bbisi\b/i, "green peas cooking spring"],
  [/\bran[ae]\b|delle\s+rane/i, "frying food Italian traditional"],
  [/\buva\b|vendemmia/i, "grape harvest vineyard"],
  [/\bmiele\b/i, "honey pouring golden"],
  [/fico\b|fichi\b|figh\b/i, "fresh figs fruit Italian"],
  [/giuggiola|giuggiole/i, "Italian fruit dessert"],
  [/cioccolat/i, "chocolate dessert Italian"],
  [/torta/i, "Italian cake dessert baking"],
  [/fagiol/i, "beans cooking Italian rustic"],
  [/patat[ae]/i, "potato cooking Italian dish"],
  [/lenticch/i, "lentils cooking Italian"],
  [/\berbe\b|erborist/i, "herbs garden Italian cooking"],
  [/gargat/i, "fresh pasta Italian making"],
  // Broader categories
  [/gnocch|gnoche/i, "gnocchi pasta Italian cooking"],
  [/fungh/i, "mushroom cooking Italian"],
  [/zucc[ah]/i, "pumpkin soup autumn cooking"],
  [/pesce|frutti.*mare|sarde|\banguilla\b|ittich/i, "Italian seafood frying Mediterranean traditional"],
  [/carne|grigliata|barbecue|griglia/i, "grilled meat barbecue Italian"],
  [/\briso\b/i, "risotto Italian cooking"],
  [/wine|vino\b|chiaretto|torcolato/i, "wine pouring glass Italian"],
  [/formaggio|formaggi|caseus/i, "cheese Italian making"],
  [/dolci|frittella|galani|fritola/i, "Italian pastry dessert making"],
  [/pane\b/i, "bread baking Italian"],
  // Seasons
  [/primavera/i, "spring Italian countryside flowers"],
  [/estate|ferragosto/i, "summer Italian food outdoor"],
  [/autunno/i, "autumn harvest Italian food"],
  [/inverno|natale/i, "winter Italian food warm"],
];

/** Fallback: food tag → video query (always exclude Asian food) */
const TAG_QUERIES: Record<string, string> = {
  Pesce: "seafood cooking Mediterranean -asian -sushi -chopsticks",
  Carne: "grilled meat barbecue Italian -asian -chopsticks",
  Vino: "wine pouring glass Italian -asian",
  Formaggi: "cheese Italian making -asian",
  Funghi: "mushroom cooking Italian -asian -ramen",
  Radicchio: "radicchio salad Italian -asian",
  Dolci: "Italian pastry dessert making -asian",
  Zucca: "pumpkin soup cooking Italian -asian",
  Gnocchi: "gnocchi pasta Italian -asian -ramen",
  Pane: "bread baking Italian -asian",
  Verdura: "vegetables cooking Italian -asian -chopsticks",
  "Prodotti Tipici": "Italian charcuterie cheese board -asian -sushi",
};

function extractThemeQuery(title: string, foodTags?: string[] | null): string | null {
  for (const [pattern, query] of TITLE_THEMES) {
    if (pattern.test(title)) return query;
  }
  if (foodTags?.length) {
    for (const tag of foodTags) {
      if (TAG_QUERIES[tag]) return TAG_QUERIES[tag];
    }
  }
  return null;
}

/**
 * Search Pexels for a video matching the sagra's FOOD theme.
 * NEVER searches by city name — only food/subject queries.
 * Priority: title theme → food tag → generic Italian food.
 */
export async function searchCityVideo(
  locationText: string,
  province?: string | null,
  title?: string,
  foodTags?: string[] | null,
): Promise<string | null> {
  if (!PEXELS_API_KEY) return null;

  const themeQuery = title ? extractThemeQuery(title, foodTags) : null;

  const queries = [
    themeQuery,
    "Italian food cooking rustic -asian -chopsticks -sushi", // Generic food fallback (NEVER city/province, NEVER Asian)
  ].filter(Boolean) as string[];

  for (const query of queries) {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&size=small&orientation=landscape`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: PEXELS_API_KEY },
        next: { revalidate: 86400 },
      });

      if (!res.ok) continue;

      const data: PexelsSearchResponse = await res.json();
      if (data.videos.length === 0) continue;

      const video = data.videos[0];
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
 */
export function extractCityName(locationText: string): string {
  return locationText.replace(/\s*\([^)]+\)\s*$/, "").trim();
}
