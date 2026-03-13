/**
 * Food type icon mapping for sagra cards and scroll row titles.
 * Maps FOOD_TAGS values to icon categories with themed colors.
 */

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
const TAG_TO_CATEGORY: Record<string, FoodCategory> = {
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
 * Determine the primary food category from an array of food tags.
 * Picks the highest-priority specific category, falling back to "altro".
 */
export function getPrimaryCategory(
  foodTags: string[] | null | undefined,
  featureTags?: string[] | null | undefined,
): FoodCategory {
  if (!foodTags || foodTags.length === 0) {
    return "altro";
  }

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

  return best;
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
  /** Drumstick — recognizable meat icon at any size */
  carne: ({ className }) => (
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
      {/* Meat body */}
      <circle cx="15" cy="8" r="5.5" />
      {/* Bone shaft */}
      <path d="M11 12L5 18" />
      {/* Bone end */}
      <path d="M5 18l-1.5 1.5M5 18l1.5 1.5" />
    </svg>
  ),

  /** Simple fish silhouette */
  pesce: ({ className }) => (
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
      <path d="M2 12c3-4 7-6 12-6 1.5 0 3 .5 4.5 1L22 12l-3.5 5c-1.5.5-3 1-4.5 1-5 0-9-2-12-6z" />
      <path d="M18 7l2-3M18 17l2 3" />
      <circle cx="16" cy="11" r="1" fill="currentColor" />
    </svg>
  ),

  /** Pumpkin — dedicated orange icon */
  zucca: ({ className }) => (
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
      <path d="M12 3c-1 0-2 .5-2 1.5S11 6 12 7c1-1 2-1.5 2-2.5S13 3 12 3z" />
      <path d="M7 8c-2.5 1-4 4-4 7s2 5 5 5c1.5 0 2.8-.5 4-2 1.2 1.5 2.5 2 4 2 3 0 5-2 5-5s-1.5-6-4-7" />
      <path d="M12 7v11" />
    </svg>
  ),

  /** Leaf — green for all vegetables (except zucca) */
  verdura: ({ className }) => (
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
      <path d="M6 21c1-4 3-7 6-10 3-3 6-5 9-6-1 3-3 6-6 9-3 3-6 5-9 6z" />
      <path d="M6 21c0-5 2-9 6-13" />
    </svg>
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

  /** Fork + knife crossed — generic sagra icon, bold for 16px readability */
  altro: ({ className }) => (
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
      {/* Fork — 3 tines + handle */}
      <path d="M7 2v6c0 1.1.9 2 2 2h0" />
      <path d="M7 10v12" />
      <path d="M5 2v4" />
      <path d="M9 2v4" />
      {/* Knife — blade + handle */}
      <path d="M17 2c-1 0-2.5 1-2.5 4s1.5 4 2.5 4v12" />
    </svg>
  ),
};

interface FoodIconProps {
  foodTags: string[] | null;
  featureTags?: string[] | null;
  className?: string;
  style?: React.CSSProperties;
  /** When true, automatically applies the themed category color */
  themed?: boolean;
}

/**
 * Renders the appropriate food category SVG icon based on food tags.
 * Falls back to "altro" (fork+knife) when no specific match is found.
 * Pass themed=true to auto-apply the category color.
 */
export function FoodIcon({ foodTags, featureTags, className, style, themed }: FoodIconProps) {
  const category = getPrimaryCategory(foodTags, featureTags);
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
