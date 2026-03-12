/**
 * Maps food_tags to local fallback images in /public/images/fallback/.
 * Used when a sagra has no image_url from the pipeline.
 * Deterministic selection based on sagra ID for SSR/hydration consistency.
 */

const CATEGORY_IMAGES: Record<string, string[]> = {
  carne: ["/images/fallback/carne-1.jpg", "/images/fallback/carne-2.jpg", "/images/fallback/carne-3.jpg"],
  pesce: ["/images/fallback/pesce-1.jpg", "/images/fallback/pesce-2.jpg", "/images/fallback/pesce-3.jpg"],
  vino: ["/images/fallback/vino-1.jpg", "/images/fallback/vino-2.jpg", "/images/fallback/vino-3.jpg"],
  zucca: ["/images/fallback/zucca-1.jpg", "/images/fallback/zucca-2.jpg", "/images/fallback/zucca-3.jpg"],
  formaggi: ["/images/fallback/formaggi-1.jpg", "/images/fallback/formaggi-2.jpg", "/images/fallback/formaggi-3.jpg"],
  funghi: ["/images/fallback/funghi-1.jpg", "/images/fallback/funghi-2.jpg", "/images/fallback/funghi-3.jpg"],
  gnocchi: ["/images/fallback/gnocchi-1.jpg", "/images/fallback/gnocchi-2.jpg", "/images/fallback/gnocchi-3.jpg"],
  dolci: ["/images/fallback/dolci-1.jpg", "/images/fallback/dolci-2.jpg", "/images/fallback/dolci-3.jpg"],
  verdura: ["/images/fallback/verdura-1.jpg", "/images/fallback/verdura-2.jpg", "/images/fallback/verdura-3.jpg"],
  "prodotti-tipici": ["/images/fallback/prodotti-tipici-1.jpg", "/images/fallback/prodotti-tipici-2.jpg", "/images/fallback/prodotti-tipici-3.jpg"],
  generico: ["/images/fallback/generico-1.jpg", "/images/fallback/generico-2.jpg", "/images/fallback/generico-3.jpg"],
};

/** Maps food_tag display values to image categories */
const TAG_TO_CATEGORY: Record<string, string> = {
  Carne: "carne",
  Pesce: "pesce",
  Vino: "vino",
  Zucca: "zucca",
  Formaggi: "formaggi",
  Funghi: "funghi",
  Gnocchi: "gnocchi",
  Dolci: "dolci",
  Radicchio: "verdura",
  Verdura: "verdura",
  "Prodotti Tipici": "prodotti-tipici",
};

/** Priority for category selection (higher = preferred) */
const CATEGORY_PRIORITY: Record<string, number> = {
  carne: 6,
  pesce: 5,
  zucca: 4,
  gnocchi: 3,
  funghi: 3,
  vino: 2,
  formaggi: 2,
  dolci: 2,
  verdura: 1,
  "prodotti-tipici": 1,
};

/** Simple string hash for deterministic image selection */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Get a fallback image path for a sagra without an image_url.
 * Selection is deterministic based on sagra ID for SSR consistency.
 */
export function getFallbackImage(
  sagraId: string,
  foodTags?: string[] | null
): string {
  let bestCategory = "generico";
  let bestPriority = -1;

  if (foodTags && foodTags.length > 0) {
    for (const tag of foodTags) {
      const category = TAG_TO_CATEGORY[tag];
      if (category) {
        const priority = CATEGORY_PRIORITY[category] ?? 0;
        if (priority > bestPriority) {
          bestPriority = priority;
          bestCategory = category;
        }
      }
    }
  }

  const images = CATEGORY_IMAGES[bestCategory] ?? CATEGORY_IMAGES.generico;
  const index = hashString(sagraId) % images.length;
  return images[index];
}
