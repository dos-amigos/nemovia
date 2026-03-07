/**
 * Geocoding helper functions for the enrichment pipeline.
 * Pure functions — no HTTP calls, no imports except what TypeScript provides.
 * These are copied verbatim into supabase/functions/enrich-sagre/index.ts
 * because Deno Edge Functions cannot import from the Next.js src/ directory.
 */

// Italy bounding box — coordinates outside this range are invalid geocode results
export const ITALY_BOUNDS = {
  lat: { min: 36.0, max: 47.5 },
  lon: { min: 6.0, max: 19.0 },
};

/** Veneto province names as returned by Nominatim addressdetails */
export const VENETO_PROVINCES = [
  "belluno", "padova", "rovigo", "treviso", "venezia", "verona", "vicenza",
  "provincia di belluno", "provincia di padova", "provincia di rovigo",
  "provincia di treviso", "provincia di venezia", "provincia di verona",
  "provincia di vicenza",
];

/** Check if a province string matches a Veneto province */
export function isVenetoProvince(province: string | null): boolean {
  if (!province) return false;
  return VENETO_PROVINCES.includes(province.toLowerCase().trim());
}

/**
 * Normalize location_text for better Nominatim geocoding results.
 * Handles: province codes, region prefixes, extra whitespace, common noise.
 *
 * Examples:
 *   "Verona (VR)"         → "Verona, Veneto"
 *   "Veneto - Padova"     → "Padova, Veneto"
 *   "Treviso - TV"        → "Treviso, Veneto"
 *   "Provincia di Rovigo" → "Rovigo, Veneto"
 */
export function normalizeLocationText(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  // Remove province codes: "(VR)", "- VR", ", VR"
  s = s.replace(/\s*\([A-Z]{2}\)\s*/g, "");
  s = s.replace(/\s*[-,]\s*[A-Z]{2}\s*$/g, "");
  // Remove region prefixes: "Veneto ", "Veneto - ", etc.
  s = s.replace(/^(Veneto|Lombardia|Piemonte|Emilia[\s-]?Romagna|Trentino|Friuli[\s-]?Venezia[\s-]?Giulia)\s*[-:,]?\s*/i, "");
  // Remove "Provincia di " prefix
  s = s.replace(/^Provincia\s+di\s+/i, "");
  // Collapse multiple spaces
  s = s.replace(/\s+/g, " ").trim();
  // Append ", Veneto" for Nominatim disambiguation if the result is a bare city name
  if (s && !s.includes(",")) {
    s = s + ", Veneto";
  }
  return s;
}

/** @deprecated Use normalizeLocationText instead */
export const cleanCityName = normalizeLocationText;

/**
 * Validate that a coordinate pair falls within Italy's bounding box.
 * Catches bad geocode results that land outside Italy (Nominatim ambiguity).
 */
export function isValidItalyCoord(lat: number, lon: number): boolean {
  return (
    lat >= ITALY_BOUNDS.lat.min &&
    lat <= ITALY_BOUNDS.lat.max &&
    lon >= ITALY_BOUNDS.lon.min &&
    lon <= ITALY_BOUNDS.lon.max
  );
}
