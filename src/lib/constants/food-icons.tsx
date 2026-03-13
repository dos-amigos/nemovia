/**
 * Food type icon mapping for sagra cards and scroll row titles.
 * Maps FOOD_TAGS values to icon categories with themed colors.
 */

/** The icon categories available */
export type FoodCategory =
  | "carne"
  | "pesce"
  | "zucca"
  | "verdura"
  | "gnocco"
  | "vino"
  | "dolci"
  | "giostre"
  | "altro";

/**
 * Map from food tag string to icon category.
 * Tags not listed here fall through to "altro".
 */
const TAG_TO_CATEGORY: Record<string, FoodCategory> = {
  Carne: "carne",
  Pesce: "pesce",
  Zucca: "zucca",
  Gnocchi: "gnocco",
  Funghi: "verdura",
  Radicchio: "verdura",
  Verdura: "verdura",
  Pane: "altro",
  Vino: "vino",
  Dolci: "dolci",
  Formaggi: "altro",
  "Prodotti Tipici": "altro",
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
  "giostre",
  "altro",
];

/**
 * Determine the primary food category from an array of food tags.
 * Picks the highest-priority specific category, falling back to "altro".
 * If featureTags includes "Giostre" and food category is generic, shows ferris wheel.
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
 * - Giostre: amber (luna park, festa)
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
  giostre: "#D97706",
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

  /** Ferris wheel — luna park / sagre grandi con giostre. Thick strokes + gondolas for readability at 16px */
  giostre: ({ className }) => (
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
      {/* Outer wheel rim */}
      <circle cx="12" cy="10" r="7" />
      {/* Hub */}
      <circle cx="12" cy="10" r="1" fill="currentColor" />
      {/* 6 spokes radiating from center */}
      <path d="M12 3v2.5M12 14.5V17M5 10h2.5M16.5 10H19" />
      <path d="M7.05 5.05l1.77 1.77M15.18 13.18l1.77 1.77" />
      <path d="M16.95 5.05l-1.77 1.77M8.82 13.18l-1.77 1.77" />
      {/* 4 gondola seats hanging from wheel */}
      <rect x="11" y="2" width="2" height="2.5" rx="0.5" fill="currentColor" />
      <rect x="11" y="15.5" width="2" height="2.5" rx="0.5" fill="currentColor" />
      <rect x="3.5" y="9" width="2.5" height="2" rx="0.5" fill="currentColor" />
      <rect x="18" y="9" width="2.5" height="2" rx="0.5" fill="currentColor" />
      {/* Support legs (A-frame) */}
      <path d="M8 21l4-3 4 3" strokeWidth={2.5} />
    </svg>
  ),

  /** Steaming bowl — generic food icon, clearly readable at 16px */
  altro: ({ className }) => (
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
      {/* Bowl */}
      <path d="M3 14h18" />
      <path d="M4 14c0 4 3.6 7 8 7s8-3 8-7" />
      {/* Steam wisps */}
      <path d="M8 10c0-1.5.8-2.5 0-4" />
      <path d="M12 9c0-1.5.8-2.5 0-4" />
      <path d="M16 10c0-1.5.8-2.5 0-4" />
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
 * Falls back to "altro" (steaming bowl) when no specific match is found.
 * If featureTags includes "Giostre" and food is generic, shows ferris wheel.
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
