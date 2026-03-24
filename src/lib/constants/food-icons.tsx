/**
 * Food type icon mapping for sagra cards and scroll row titles.
 * Maps FOOD_TAGS values to icon categories with themed colors.
 */

import { Beef, Leaf, UtensilsCrossed } from "lucide-react";

/** The icon categories available — NO giostre (non è cibo) */
export type FoodCategory =
  | "carne"
  | "pesce"
  | "zucca"
  | "verdura"
  | "gnocco"
  | "vino"
  | "dolci"
  | "altro";

/**
 * Map from food tag string to icon category.
 * Includes both Gemini FOOD_TAGS and common Italian food names as fallback.
 * Tags not listed here fall through to "altro".
 */
export const TAG_TO_CATEGORY: Record<string, FoodCategory> = {
  // Standard FOOD_TAGS from Gemini prompt
  Carne: "carne",
  Pesce: "pesce",
  Zucca: "zucca",
  Gnocchi: "gnocco",
  Verdura: "verdura",
  Vino: "vino",
  Dolci: "dolci",
  Pane: "altro",
  Formaggi: "altro",
  "Prodotti Tipici": "altro",
  // Specific vegetables → verdura (in case DB has raw names)
  Broccolo: "verdura",
  Brocolo: "verdura",
  Broccoli: "verdura",
  Radicchio: "verdura",
  Asparago: "verdura",
  Asparagi: "verdura",
  Funghi: "verdura",
  Carciofo: "verdura",
  Carciofi: "verdura",
  Fagioli: "verdura",
  Bisi: "verdura",
  Piselli: "verdura",
  // Specific meats → carne
  Salsiccia: "carne",
  Maiale: "carne",
  Pollo: "carne",
  Cinghiale: "carne",
  Oca: "carne",
  Anatra: "carne",
  // Specific fish → pesce
  Baccalà: "pesce",
  Stoccafisso: "pesce",
  Sarde: "pesce",
  Anguilla: "pesce",
  // Rane = carne (anfibi, NON pesci — si cucinano fritte o in umido come carne)
  Rane: "carne",
  Rana: "carne",
  // Salumi → carne
  Bondola: "carne",
  Soppressa: "carne",
  Sopressa: "carne",
  // Specific sweets → dolci
  Tiramisù: "dolci",
  Tiramisu: "dolci",
  Frittelle: "dolci",
  Galani: "dolci",
};

/** Priority order for categories (lower index = higher priority) */
const CATEGORY_PRIORITY: FoodCategory[] = [
  "carne",
  "pesce",
  "zucca",
  "gnocco",
  "verdura",
  "vino",
  "dolci",
  "altro",
];

/**
 * Title keywords → category fallback.
 * Used when food_tags don't give a specific category (old enrichment data).
 * Checked case-insensitive against the sagra title.
 */
const TITLE_TO_CATEGORY: [RegExp, FoodCategory][] = [
  // Verdura
  [/broccol|radicch|asparag|carciof|fagiol|bisi|pisell|funghi|verdur|orto/i, "verdura"],
  // Zucca (before verdura so it takes priority)
  [/zucca|zucche/i, "zucca"],
  // Carne
  [/carne|salsiccia|maiale|pollo|oca|anatra|cinghial|bistecca|grigliata|arrosto/i, "carne"],
  // Pesce
  [/pesce|baccalà|stoccafisso|sarde|anguilla|mare|frutti di mare/i, "pesce"],
  // Vino
  [/vino|vendemmia|calici|prosecco|cantina/i, "vino"],
  // Dolci
  [/dolci|tiramisu|tiramisù|frittell|galani|torta|gelato/i, "dolci"],
  // Gnocco
  [/gnocc/i, "gnocco"],
];

/**
 * Determine the primary food category from an array of food tags.
 * Picks the highest-priority specific category.
 * Falls back to title-based detection when tags are generic.
 * Last resort: "altro" (fork+knife).
 */
export function getPrimaryCategory(
  foodTags: string[] | null | undefined,
  featureTags?: string[] | null | undefined,
  title?: string | null,
): FoodCategory {
  // Step 1: Try food_tags
  if (foodTags && foodTags.length > 0) {
    let best: FoodCategory = "altro";
    let bestPriority = CATEGORY_PRIORITY.indexOf("altro");

    for (const tag of foodTags) {
      const cat = TAG_TO_CATEGORY[tag] ?? "altro";
      const pri = CATEGORY_PRIORITY.indexOf(cat);
      if (pri < bestPriority) {
        best = cat;
        bestPriority = pri;
      }
    }

    if (best !== "altro") return best;
  }

  // Step 2: Fallback — detect category from sagra title
  if (title) {
    for (const [pattern, category] of TITLE_TO_CATEGORY) {
      if (pattern.test(title)) return category;
    }
  }

  return "altro";
}

/**
 * Themed color per food category:
 * - Carne: warm brown (bistecca, arrosto)
 * - Pesce: sky blue (mare, oceano)
 * - Vino: bordeaux (vino rosso)
 * - Zucca: orange (zucca, autunno)
 * - Verdura: green (foglia, orto)
 * - Gnocco: golden/wheat (pasta, grano)
 * - Dolci: magenta/pink (dolcezza)
 * - Altro: coral (brand primary)
 */
export const CATEGORY_COLORS: Record<FoodCategory, string> = {
  carne: "#7C2D12",
  pesce: "#0EA5E9",
  vino: "#881337",
  zucca: "#EA580C",
  verdura: "#16A34A",
  gnocco: "#CA8A04",
  dolci: "#DB2777",
  altro: "#9B1B30",
};

/** Get themed color for a set of food tags */
export function getCategoryColor(
  foodTags: string[] | null | undefined,
  featureTags?: string[] | null | undefined,
): string {
  return CATEGORY_COLORS[getPrimaryCategory(foodTags, featureTags)];
}

/** SVG icon render functions keyed by category */
const ICONS: Record<
  FoodCategory,
  (props: { className?: string }) => React.ReactElement
> = {
  /** Beef cut — Lucide Beef icon. Recognizable steak cross-section at all sizes. */
  carne: ({ className }) => (
    <Beef className={className} aria-hidden="true" />
  ),

  /** Fish — Tabler Icons fish, clear side-view with tail, fin, eye */
  pesce: ({ className }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16.69 7.44a6.973 6.973 0 0 0 -1.69 4.56c0 1.747 .64 3.345 1.699 4.571" />
      <path d="M2 9.504c7.715 8.647 14.75 10.265 20 2.498c-5.25 -7.761 -12.285 -6.142 -20 2.504" />
      <path d="M18 11v.01" />
      <path d="M11.5 10.5c-.667 1 -.667 2 0 3" />
    </svg>
  ),

  /** Pumpkin — Tabler Icons pumpkin body + stem (no face) */
  zucca: ({ className }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17 6.082c2.609 .588 3.627 4.162 2.723 7.983c-.903 3.82 -2.75 6.44 -5.359 5.853a3.355 3.355 0 0 1 -.774 -.279a3.728 3.728 0 0 1 -1.59 .361c-.556 0 -1.09 -.127 -1.59 -.362a3.296 3.296 0 0 1 -.774 .28c-2.609 .588 -4.456 -2.033 -5.36 -5.853c-.903 -3.82 .115 -7.395 2.724 -7.983c1.085 -.244 1.575 .066 2.585 .787c.716 -.554 1.54 -.869 2.415 -.869c.876 0 1.699 .315 2.415 .87c1.01 -.722 1.5 -1.032 2.585 -.788" />
      <path d="M12 6c0 -1.226 .693 -2.346 1.789 -2.894l.211 -.106" />
    </svg>
  ),

  /** Leaf — green for all vegetables (except zucca). Uses Lucide Leaf for better visibility at small sizes. */
  verdura: ({ className }) => (
    <Leaf className={className} aria-hidden="true" />
  ),

  /** Small dumpling / round shape */
  gnocco: ({ className }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="12" cy="14" rx="8" ry="5" />
      <path d="M8 12c0-2 1.8-4 4-4s4 2 4 4" />
      <path d="M9 14.5h1M11.5 14.5h1M14 14.5h1" />
    </svg>
  ),

  /** Wine glass */
  vino: ({ className }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 2h8M12 2v20M9 22h6" />
      <path d="M7 6c0 4.4 2.2 8 5 8s5-3.6 5-8c0-1.1-.2-2-.6-3H7.6c-.4 1-.6 1.9-.6 3z" />
    </svg>
  ),

  /** Cupcake with frosting swirl */
  dolci: ({ className }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Cherry on top */}
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <path d="M12 6.5v1" />
      {/* Frosting dome */}
      <path d="M6 13c0-4 2.5-5.5 6-5.5s6 1.5 6 5.5" />
      {/* Frosting waves */}
      <path d="M6 13c1 1 2 1.5 3 .5s2-.5 3 .5 2 .5 3-.5 2-.5 3 .5" />
      {/* Cup/wrapper */}
      <path d="M7 15l1.5 6h7L17 15" />
    </svg>
  ),

  /** Fork + knife crossed — generic sagra icon. Uses Lucide UtensilsCrossed for better readability. */
  altro: ({ className }) => (
    <UtensilsCrossed className={className} aria-hidden="true" />
  ),
};

interface FoodIconProps {
  foodTags: string[] | null;
  featureTags?: string[] | null;
  /** Sagra title — used as fallback to detect food category from name */
  title?: string | null;
  className?: string;
  style?: React.CSSProperties;
  /** When true, automatically applies the themed category color */
  themed?: boolean;
}

/**
 * Renders the appropriate food category SVG icon based on food tags.
 * Falls back to title-based detection, then "altro" (fork+knife).
 * Pass themed=true to auto-apply the category color.
 */
export function FoodIcon({ foodTags, featureTags, title, className, style, themed }: FoodIconProps) {
  const category = getPrimaryCategory(foodTags, featureTags, title);
  const IconFn = ICONS[category];
  const mergedStyle = themed
    ? { color: CATEGORY_COLORS[category], ...style }
    : style;
  return (
    <span style={mergedStyle} className="inline-flex">
      <IconFn className={className} />
    </span>
  );
}

/**
 * Get ALL unique categories for a set of food tags (up to 3).
 * Returns categories in priority order, deduplicated.
 */
export function getAllCategories(
  foodTags: string[] | null | undefined,
  title?: string | null,
): FoodCategory[] {
  const categories = new Set<FoodCategory>();

  if (foodTags && foodTags.length > 0) {
    for (const tag of foodTags) {
      const cat = TAG_TO_CATEGORY[tag] ?? "altro";
      categories.add(cat);
    }
  }

  // If no specific categories from tags, try title
  if (categories.size === 0 || (categories.size === 1 && categories.has("altro"))) {
    if (title) {
      for (const [pattern, category] of TITLE_TO_CATEGORY) {
        if (pattern.test(title)) {
          categories.add(category);
          break;
        }
      }
    }
  }

  // If still nothing, return empty (NO icon, as per rules)
  if (categories.size === 0) return [];

  // Sort by priority and return up to 3
  return [...categories]
    .sort((a, b) => CATEGORY_PRIORITY.indexOf(a) - CATEGORY_PRIORITY.indexOf(b))
    .slice(0, 3);
}

interface FoodIconsProps {
  foodTags: string[] | null;
  title?: string | null;
  className?: string;
  themed?: boolean;
}

/**
 * Renders MULTIPLE food category icons (up to 3) side by side.
 * Each icon gets its themed color. Shows nothing if no category matches.
 */
export function FoodIcons({ foodTags, title, className, themed }: FoodIconsProps) {
  const categories = getAllCategories(foodTags, title);
  if (categories.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-0.5">
      {categories.map((cat) => {
        const IconFn = ICONS[cat];
        return (
          <span
            key={cat}
            style={themed ? { color: CATEGORY_COLORS[cat] } : undefined}
            className="inline-flex"
          >
            <IconFn className={className} />
          </span>
        );
      })}
    </span>
  );
}
