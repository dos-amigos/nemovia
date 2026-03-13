/**
 * Domain constants for the Veneto sagra discovery UI.
 * Provinces, quick filter chips, and shared field selections.
 */

export const VENETO_PROVINCES = [
  { name: "Belluno", code: "BL" },
  { name: "Padova", code: "PD" },
  { name: "Rovigo", code: "RO" },
  { name: "Treviso", code: "TV" },
  { name: "Venezia", code: "VE" },
  { name: "Verona", code: "VR" },
  { name: "Vicenza", code: "VI" },
] as const;

export type VenetoProvince = (typeof VENETO_PROVINCES)[number];

export const QUICK_FILTER_CHIPS = [
  { label: "Pesce", emoji: "\uD83D\uDC1F", param: "cucina", value: "Pesce" },
  { label: "Carne", emoji: "\uD83E\uDD69", param: "cucina", value: "Carne" },
  { label: "Formaggi", emoji: "\uD83E\uDDC0", param: "cucina", value: "Formaggi" },
  { label: "Vino", emoji: "\uD83C\uDF77", param: "cucina", value: "Vino" },
  { label: "Radicchio", emoji: "\uD83E\uDD6C", param: "cucina", value: "Radicchio" },
  { label: "Funghi", emoji: "\uD83C\uDF44", param: "cucina", value: "Funghi" },
  { label: "Gratis", emoji: "\uD83C\uDD93", param: "gratis", value: "true" },
  { label: "Oggi", emoji: "\uD83D\uDCC5", param: "da", value: "today" },
] as const;

export type QuickFilterChip = (typeof QUICK_FILTER_CHIPS)[number];

/**
 * Column selection string for sagra card queries.
 * Keeps network payloads lean -- only fields the SagraCard component needs.
 */
export const SAGRA_CARD_FIELDS =
  "id, title, slug, location_text, province, start_date, end_date, enhanced_description, food_tags, feature_tags, image_url, image_credit, is_free, price_info";

/**
 * Column selection string for map marker queries.
 * Even leaner than card fields -- only what pins and popups need.
 */
export const MAP_MARKER_FIELDS =
  "id, slug, title, location_text, province, start_date, end_date, food_tags, location, is_free";

/**
 * Map from Nominatim province text (lowercase) to 2-letter province code.
 * Covers both bare names ("padova") and full forms ("provincia di padova").
 */
export const PROVINCE_CODE_MAP: Record<string, string> = {
  "belluno": "BL", "provincia di belluno": "BL",
  "padova": "PD", "provincia di padova": "PD",
  "rovigo": "RO", "provincia di rovigo": "RO",
  "treviso": "TV", "provincia di treviso": "TV",
  "venezia": "VE", "provincia di venezia": "VE",
  "verona": "VR", "provincia di verona": "VR",
  "vicenza": "VI", "provincia di vicenza": "VI",
};

/** Approximate geographic center of the Veneto region. */
export const VENETO_CENTER: [number, number] = [45.44, 12.32];

/** Default zoom level showing the full Veneto region. */
export const DEFAULT_MAP_ZOOM = 8;
