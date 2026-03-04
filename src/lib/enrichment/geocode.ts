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

/**
 * Strip Italian province codes from city strings before geocoding.
 * Nominatim handles bare city names better than "Verona (VR)" or "Verona - VR".
 *
 * Examples:
 *   "Verona (VR)"  → "Verona"
 *   "Treviso - TV" → "Treviso"
 *   "Padova"       → "Padova"
 */
export function cleanCityName(raw: string): string {
  return raw
    .replace(/\s*\([A-Z]{2}\)\s*/g, "")  // remove "(VR)" style codes
    .replace(/\s*-\s*[A-Z]{2}$/g, "")    // remove " - VR" suffix
    .trim();
}

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
