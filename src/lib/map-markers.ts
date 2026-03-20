/**
 * Themed Leaflet map markers for sagra food categories.
 *
 * Each marker is a colored teardrop pin with a white food icon inside.
 * Uses L.divIcon with inline SVG for maximum performance (no extra HTTP requests).
 * Icons are cached per category so each divIcon is created only once.
 */

import L from "leaflet";
import {
  type FoodCategory,
  getPrimaryCategory,
  CATEGORY_COLORS,
} from "@/lib/constants/food-icons";

/* -------------------------------------------------------------------------- */
/*  Simplified SVG icon paths (white, stroke-only, viewBox 0 0 24 24)         */
/* -------------------------------------------------------------------------- */

const MARKER_ICON_PATHS: Record<FoodCategory, string> = {
  /** Beef cut — Lucide Beef icon paths */
  carne: `<path d="M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3"/><path d="m18.5 6 2.19 4.5a6.48 6.48 0 0 1-2.29 7.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5"/><circle cx="12.5" cy="8.5" r="2.5"/>`,

  /** Fish — Tabler Icons fish */
  pesce: `<path d="M16.69 7.44a6.973 6.973 0 0 0 -1.69 4.56c0 1.747 .64 3.345 1.699 4.571"/><path d="M2 9.504c7.715 8.647 14.75 10.265 20 2.498c-5.25 -7.761 -12.285 -6.142 -20 2.504"/><circle cx="18" cy="11" r="0.5" fill="white"/>`,

  /** Pumpkin */
  zucca: `<path d="M12 3c-1 0-2 .5-2 1.5S11 6 12 7c1-1 2-1.5 2-2.5S13 3 12 3z"/><path d="M7 8c-2.5 1-4 4-4 7s2 5 5 5c1.5 0 2.8-.5 4-2 1.2 1.5 2.5 2 4 2 3 0 5-2 5-5s-1.5-6-4-7"/><path d="M12 7v11"/>`,

  /** Leaf (Lucide) */
  verdura: `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>`,

  /** Dumpling */
  gnocco: `<ellipse cx="12" cy="14" rx="8" ry="5"/><path d="M8 12c0-2 1.8-4 4-4s4 2 4 4"/><path d="M9 14.5h1M11.5 14.5h1M14 14.5h1"/>`,

  /** Wine glass */
  vino: `<path d="M8 2h8M12 2v20M9 22h6"/><path d="M7 6c0 4.4 2.2 8 5 8s5-3.6 5-8c0-1.1-.2-2-.6-3H7.6c-.4 1-.6 1.9-.6 3z"/>`,

  /** Cupcake */
  dolci: `<circle cx="12" cy="5" r="1.5" fill="white"/><path d="M12 6.5v1"/><path d="M6 13c0-4 2.5-5.5 6-5.5s6 1.5 6 5.5"/><path d="M6 13c1 1 2 1.5 3 .5s2-.5 3 .5 2 .5 3-.5 2-.5 3 .5"/><path d="M7 15l1.5 6h7L17 15"/>`,

  /** Fork + knife crossed (Lucide UtensilsCrossed) */
  altro: `<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>`,
};

/* -------------------------------------------------------------------------- */
/*  SVG marker template — 40x56 pin with large icon inside                    */
/* -------------------------------------------------------------------------- */

/**
 * Builds a self-contained SVG string for a teardrop map pin with an icon.
 * The pin is 40x56 px with rounded top and pointed bottom.
 * Icon is scaled large (0.83) so it's clearly visible at map zoom levels.
 */
function buildMarkerSvg(color: string, iconPaths: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="56" viewBox="0 0 40 56">
  <!-- Drop shadow -->
  <defs>
    <filter id="s" x="-20%" y="-10%" width="140%" height="130%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.3"/>
    </filter>
  </defs>
  <!-- Teardrop pin shape -->
  <path d="M20 54 C20 54 4 34 4 20 A16 16 0 1 1 36 20 C36 34 20 54 20 54Z"
        fill="${color}" stroke="white" stroke-width="2" filter="url(#s)"/>
  <!-- White food icon centered in the circle part of the pin -->
  <g transform="translate(10,12) scale(0.83)">
    <svg viewBox="0 0 24 24" width="24" height="24"
         fill="none" stroke="white" stroke-width="2.2"
         stroke-linecap="round" stroke-linejoin="round">
      ${iconPaths}
    </svg>
  </g>
</svg>`;
}

/* -------------------------------------------------------------------------- */
/*  Icon cache & public API                                                   */
/* -------------------------------------------------------------------------- */

const MARKER_SIZE: [number, number] = [40, 56];
const ICON_ANCHOR: [number, number] = [20, 56]; // bottom-center of pin
const POPUP_ANCHOR: [number, number] = [0, -56]; // top-center of pin

/** Cache: one L.DivIcon per food category */
const iconCache = new Map<FoodCategory, L.DivIcon>();

/**
 * Returns a cached Leaflet DivIcon for the given food category.
 */
export function getCategoryMarkerIcon(category: FoodCategory): L.DivIcon {
  const cached = iconCache.get(category);
  if (cached) return cached;

  const color = CATEGORY_COLORS[category];
  const paths = MARKER_ICON_PATHS[category];
  const html = buildMarkerSvg(color, paths);

  const icon = L.divIcon({
    html,
    className: "", // clear default leaflet-div-icon styling
    iconSize: MARKER_SIZE,
    iconAnchor: ICON_ANCHOR,
    popupAnchor: POPUP_ANCHOR,
  });

  iconCache.set(category, icon);
  return icon;
}

/**
 * Returns the appropriate themed marker icon for a sagra based on its food tags.
 * This is the main entry point for map components.
 *
 * @example
 * <Marker position={pos} icon={getMarkerIcon(sagra.food_tags)}>
 */
export function getMarkerIcon(
  foodTags: string[] | null | undefined,
  title?: string | null,
): L.DivIcon {
  const category = getPrimaryCategory(foodTags, undefined, title);
  return getCategoryMarkerIcon(category);
}
