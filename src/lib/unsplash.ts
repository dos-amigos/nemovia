// =============================================================================
// Unsplash integration utilities
// Hero image rotation, credit parsing, and tag-to-query mapping
// =============================================================================

/**
 * A curated Unsplash hero image for the landing page.
 */
export interface UnsplashHeroImage {
  url: string;
  photographer: string;
  photographerUrl: string;
  unsplashUrl: string;
}

/**
 * Curated high-quality Italian food/festival landscape photos from Unsplash.
 * Each photo includes UTM attribution parameters as required by the Unsplash API guidelines.
 */
const HERO_IMAGES: UnsplashHeroImage[] = [
  {
    url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1920&h=600&fit=crop&q=80&utm_source=nemovia&utm_medium=referral",
    photographer: "Eiliv Aceron",
    photographerUrl:
      "https://unsplash.com/@eilivaceron?utm_source=nemovia&utm_medium=referral",
    unsplashUrl:
      "https://unsplash.com/photos/photo-1555939594-58d7cb561ad1?utm_source=nemovia&utm_medium=referral",
  },
  {
    url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&h=600&fit=crop&q=80&utm_source=nemovia&utm_medium=referral",
    photographer: "Brooke Lark",
    photographerUrl:
      "https://unsplash.com/@brookelark?utm_source=nemovia&utm_medium=referral",
    unsplashUrl:
      "https://unsplash.com/photos/photo-1504674900247-0877df9cc836?utm_source=nemovia&utm_medium=referral",
  },
  {
    url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&h=600&fit=crop&q=80&utm_source=nemovia&utm_medium=referral",
    photographer: "Jay Wennington",
    photographerUrl:
      "https://unsplash.com/@jaywennington?utm_source=nemovia&utm_medium=referral",
    unsplashUrl:
      "https://unsplash.com/photos/photo-1414235077428-338989a2e8c0?utm_source=nemovia&utm_medium=referral",
  },
  {
    url: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=1920&h=600&fit=crop&q=80&utm_source=nemovia&utm_medium=referral",
    photographer: "Brooke Lark",
    photographerUrl:
      "https://unsplash.com/@brookelark?utm_source=nemovia&utm_medium=referral",
    unsplashUrl:
      "https://unsplash.com/photos/photo-1476224203421-9ac39bcb3327?utm_source=nemovia&utm_medium=referral",
  },
  {
    url: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1920&h=600&fit=crop&q=80&utm_source=nemovia&utm_medium=referral",
    photographer: "Priscilla Du Preez",
    photographerUrl:
      "https://unsplash.com/@priscilladupreez?utm_source=nemovia&utm_medium=referral",
    unsplashUrl:
      "https://unsplash.com/photos/photo-1528605248644-14dd04022da1?utm_source=nemovia&utm_medium=referral",
  },
];

/**
 * Get the hero image for today's landing page.
 * Rotates daily by using the current day index modulo the number of curated images.
 */
export function getHeroImage(): UnsplashHeroImage {
  return HERO_IMAGES[
    Math.floor(Date.now() / 86_400_000) % HERO_IMAGES.length
  ];
}

/**
 * Parse an image credit string in the format "Photographer Name|profile_url".
 * Returns null for null, empty, or malformed input (no pipe delimiter).
 */
export function parseImageCredit(
  credit: string | null
): { name: string; url: string } | null {
  if (!credit || !credit.includes("|")) return null;
  const [name, url] = credit.split("|", 2);
  if (!name || !url) return null;
  return { name, url };
}

/**
 * Maps known food tags to Unsplash search queries for relevant Italian food imagery.
 */
export const TAG_QUERIES: Record<string, string> = {
  Pesce: "italian seafood festival",
  Carne: "italian meat grill festival",
  Vino: "italian wine festival",
  Formaggi: "italian cheese market",
  Funghi: "mushroom food festival",
  Radicchio: "italian vegetable market",
  Dolci: "italian dessert pastry",
  "Prodotti Tipici": "italian food market",
};

/**
 * Default Unsplash search query when no food tag matches.
 */
export const DEFAULT_QUERY = "italian sagra food festival";
