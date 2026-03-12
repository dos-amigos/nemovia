/**
 * Maps food_tags to local fallback images in /public/images/fallback/.
 * Used when a sagra has no image_url from the pipeline.
 * Deterministic selection based on sagra ID for SSR/hydration consistency.
 *
 * Also exports isLowQualityUrl() for detecting known bad/low-res image patterns
 * from scraped sources (site logos, placeholder images, tracking pixels, tiny thumbnails).
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

// =============================================================================
// Low-quality / bad image URL detection
// =============================================================================

/**
 * Known patterns that indicate a scraped image_url is NOT a real event photo.
 * These are site logos, default placeholders, tracking pixels, or tiny thumbnails
 * that should be replaced with a themed Unsplash/local fallback.
 */
const BAD_IMAGE_PATTERNS: RegExp[] = [
  // Tracking pixels and spacer GIFs
  /spacer\.(gif|png)/i,
  /pixel\.(gif|png)/i,
  /1x1\.(gif|png|jpg)/i,
  /blank\.(gif|png|jpg)/i,
  /transparent\.(gif|png)/i,

  // Common placeholder / default image filenames
  /no[-_]?image/i,
  /no[-_]?photo/i,
  /no[-_]?pic/i,
  /default[-_]?(image|img|photo|thumb)/i,
  /placeholder/i,
  /coming[-_]?soon/i,
  /image[-_]?not[-_]?found/i,
  /missing[-_]?(image|photo)/i,

  // Site logos and branding (not event photos)
  /\blogo[-_]?(sito|site|header|footer|main)?\b.*\.(png|jpg|svg|gif|webp)$/i,
  /\bfavicon\b/i,
  /\bicon[-_]?\d*\.(png|ico|svg)/i,

  // WordPress placeholder patterns
  /wp-content\/plugins\/.*placeholder/i,
  /woocommerce-placeholder/i,

  // Data URIs (shouldn't be in DB but just in case)
  /^data:image/i,

  // Very small dimension indicators in URL (e.g., ?w=50, -50x50)
  /[?&]w=([1-9]\d?|1[0-4]\d|150)(&|$)/,  // width <= 150 in query param
  /[?&]h=([1-9]\d?|1[0-4]\d|150)(&|$)/,   // height <= 150 in query param
  /-(\d{1,2}|1[0-4]\d|150)x(\d{1,2}|1[0-4]\d|150)\.\w+$/,  // WxH suffix <= 150x150
];

/**
 * Returns true if the image URL matches known low-quality / bad image patterns.
 * Used both at display time (client) and in the enrich pipeline (Edge Function).
 */
export function isLowQualityUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;

  for (const pattern of BAD_IMAGE_PATTERNS) {
    if (pattern.test(url)) return true;
  }

  return false;
}

// =============================================================================
// Deterministic fallback image selection
// =============================================================================

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
