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
  /** T-bone steak */
  carne: `<path d="M6 4c-2 1-3 3.5-2.5 6s2.5 4.5 5 5c2 .4 3.5-.2 4.5-1l5-5c1-1 1.5-2.5.5-3.5S16 4.5 15 5.5l-5 5"/><circle cx="8" cy="10" r="2"/>`,

  /** Fish */
  pesce: `<path d="M2 12c3-4 7-6 12-6 1.5 0 3 .5 4.5 1L22 12l-3.5 5c-1.5.5-3 1-4.5 1-5 0-9-2-12-6z"/><circle cx="16" cy="11" r="1" fill="white"/>`,

  /** Pumpkin */
  zucca: `<path d="M12 3c-1 0-2 .5-2 1.5S11 6 12 7c1-1 2-1.5 2-2.5S13 3 12 3z"/><path d="M7 8c-2.5 1-4 4-4 7s2 5 5 5c1.5 0 2.8-.5 4-2 1.2 1.5 2.5 2 4 2 3 0 5-2 5-5s-1.5-6-4-7"/><path d="M12 7v11"/>`,

  /** Leaf */
  verdura: `<path d="M6 21c1-4 3-7 6-10 3-3 6-5 9-6-1 3-3 6-6 9-3 3-6 5-9 6z"/><path d="M6 21c0-5 2-9 6-13"/>`,

  /** Dumpling */
  gnocco: `<ellipse cx="12" cy="14" rx="8" ry="5"/><path d="M8 12c0-2 1.8-4 4-4s4 2 4 4"/><path d="M9 14.5h1M11.5 14.5h1M14 14.5h1"/>`,

  /** Wine glass */
  vino: `<path d="M8 2h8M12 2v20M9 22h6"/><path d="M7 6c0 4.4 2.2 8 5 8s5-3.6 5-8c0-1.1-.2-2-.6-3H7.6c-.4 1-.6 1.9-.6 3z"/>`,

  /** Cake */
  dolci: `<path d="M3 20h18v-8H3v8z"/><path d="M5 12V6l2-2 2 2V6l2-2 2 2V6l2-2 2 2v6"/><path d="M7 20v-4M12 20v-4M17 20v-4"/>`,

  /** Fork + knife (generic) */
  altro: `<path d="M11 2v7a4 4 0 0 1-2 3.5V22h4v-9.5A4 4 0 0 1 11 9V2z"/><path d="M3 2v7c0 1.7 1.3 3 3 3v10h1V12c1.7 0 3-1.3 3-3V2"/><path d="M19 2l-1 9h-2l-1-9"/><path d="M17 11v11"/>`,
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
  <g transform="translate(10,10) scale(0.83)">
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
): L.DivIcon {
  const category = getPrimaryCategory(foodTags);
  return getCategoryMarkerIcon(category);
}
