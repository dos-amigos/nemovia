/**
 * Heuristic data quality filter functions for the scraping pipeline.
 *
 * Each function is a pure predicate that returns `true` when an event
 * should be REJECTED (filtered out). Functions handle null/edge-case
 * inputs without throwing.
 *
 * These are the canonical implementations. The Edge Function
 * (supabase/functions/scrape-sagre/index.ts) maintains inline copies
 * due to Deno import constraints (documented tech debt).
 */

/**
 * Enhanced noise title detection.
 * Returns `true` if the title is garbage/spam and should be REJECTED.
 *
 * Covers: empty/short/long titles, calendar spam, navigation elements,
 * aggregator listings, newsletter CTAs, numeric-only strings, and
 * month-range headers.
 */
export function isNoiseTitle(title: string): boolean {
  if (!title || title.length < 5 || title.length > 150) return true;
  const t = title.toLowerCase();

  // Calendar/navigation noise (original patterns from v1.1)
  if (/calendario\s.*(mensile|regioni|italian)/i.test(t)) return true;
  if (/cookie|privacy\s*policy|termini\s*(e\s*)?condizion/i.test(t))
    return true;
  if (/cerca\s+sagr|ricerca\s+event/i.test(t)) return true;
  if (/^(menu|navigazione|home)\b/i.test(t)) return true;
  if (/^[\d\s\-\/\.]+$/.test(title.trim())) return true;
  if (/tutte le sagre|elenco sagre|lista sagre/i.test(t)) return true;
  if (/gennaio.*dicembre|dicembre.*gennaio/i.test(t)) return true;

  // NEW: Expanded calendar spam -- "calendario" combined with event keywords
  // but NOT standalone "calendario" (avoids false positives like
  // "Sagra della Polenta - Calendario 2026")
  if (/calendario\b/i.test(t) && /\beventi\b|\bsagre\b|\bfeste\b/i.test(t))
    return true;

  // NEW: Program/schedule spam
  if (/programma\s+(completo|mensile|settimanale)/i.test(t)) return true;

  // NEW: "Discover all" / "See all" CTAs
  if (/scopri\s+tutt[ei]|vedi\s+tutt[ei]/i.test(t)) return true;

  // NEW: Newsletter/signup noise
  if (/newsletter|iscriviti|registrati/i.test(t)) return true;

  // Aggregator/article titles — NOT a specific sagra
  // "Sagre ed Eventi Veneto", "Eventi enogastronomici di aprile", "Le sagre di agosto"
  if (/\b(sagre|eventi|feste|fiere|festival)\s+(ed?|e|del|della|dei|in|nel)\s+(eventi|sagre|feste|fiere|veneto|italia)/i.test(t)) return true;
  if (/\beventi\s+enogastronomic/i.test(t)) return true;
  if (/\b(le\s+sagre|le\s+feste|gli\s+eventi)\s+(di|del|della|da|vicino|più)\b/i.test(t)) return true;
  if (/\b(cosa\s+fare|dove\s+andare|weekend|week\s*end)\b/i.test(t)) return true;

  return false;
}

/**
 * Non-sagra title detection with whitelist protection.
 * Returns `true` if the title describes a non-sagra event (standalone concert,
 * market, theatre show, sporting event, etc.) and should be REJECTED.
 *
 * Whitelist-aware: titles containing sagra/festa/food keywords are NEVER
 * rejected, even if they also contain non-sagra keywords (e.g.
 * "Sagra e Fiera del Radicchio" is allowed despite "fiera").
 *
 * Handles null/empty input safely (returns false).
 */
export function isNonSagraTitle(title: string): boolean {
  if (!title || title.length === 0) return false;
  const t = title.toLowerCase();

  // Whitelist: if title contains SPECIFIC sagra/food keywords, don't reject.
  // But PLURAL forms ("sagre", "feste", "eventi") are often article/listing titles,
  // so only whitelist SINGULAR forms or specific food items.
  if (
    /\b(sagra|festa\s+d[ei]l|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|birra|griglia)/i.test(
      t
    )
  ) {
    return false;
  }

  // Non-sagra patterns: reject if the primary subject is a non-sagra event
  if (
    /\b(passeggiata|camminata|marcia)\b/i.test(t) ||
    /\bcarnevale\b/i.test(t) ||
    /\b(concerto|concerti|recital)\b/i.test(t) ||
    /\b(mostra|mostre|esposizione)\b/i.test(t) ||
    /\b(antiquariato|collezionismo)\b/i.test(t) ||
    /\b(teatro|teatrale|commedia|spettacolo)\b/i.test(t) ||
    /\b(maratona|corsa|gara\s+ciclistica|gara\s+podistica)\b/i.test(t) ||
    /\b(convegno|conferenza|seminario)\b/i.test(t) ||
    /\b(cinema|cineforum|proiezione)\b/i.test(t) ||
    /\b(yoga|fitness|pilates)\b/i.test(t) ||
    /\b(mercato|mercatino|mercatini)\b/i.test(t) ||
    /\bfiera\b/i.test(t) ||
    /\brassegna\b/i.test(t) ||
    /\bfestival\b/i.test(t) ||
    /\b(dj|dj\s*set|lineup|line[\s-]?up)\b/i.test(t) ||
    /\b(apr[eè]s[\s-]?ski|afterski|after[\s-]?ski)\b/i.test(t) ||
    /\b(discoteca|nightclub|night[\s-]?club)\b/i.test(t) ||
    /\b(serata\s+danzante|ballo\s+liscio)\b/i.test(t)
  ) {
    return true;
  }

  return false;
}

/**
 * Attempt to upgrade a scraped image URL to a higher-resolution version.
 * Returns the upgraded URL, the original URL if no upgrade applies,
 * or null if the input is null/empty.
 *
 * Source-specific rules:
 * - sagritaly: WordPress thumbnails have `-WxH` suffix before extension; strip it
 * - solosagre: size-constraining query params (w, h, resize); remove them
 * - other sources: pass through unchanged
 */
export function tryUpgradeImageUrl(
  imageUrl: string | null,
  sourceName: string
): string | null {
  if (!imageUrl || imageUrl === "") return null;

  let upgraded: string;

  switch (sourceName) {
    case "sagritaly":
      // Strip WordPress thumbnail suffix: image-150x150.jpg -> image.jpg
      upgraded = imageUrl.replace(/-\d+x\d+(\.\w+)$/, "$1");
      break;

    case "solosagre":
      // Remove w, h, resize query params
      try {
        const url = new URL(imageUrl);
        url.searchParams.delete("w");
        url.searchParams.delete("h");
        url.searchParams.delete("resize");
        upgraded = url.toString();
      } catch {
        upgraded = imageUrl;
      }
      break;

    default:
      upgraded = imageUrl;
  }

  // After upgrading, check if the URL is a known bad pattern
  if (isLowQualityUrl(upgraded)) return null;

  return upgraded;
}

/**
 * Known patterns that indicate a scraped image URL is NOT a real event photo.
 * Covers: tracking pixels, spacer GIFs, default placeholders, site logos,
 * WordPress placeholder images, data URIs, and URLs with very small dimensions.
 *
 * Returns `true` if the image URL should be REJECTED (treated as no image).
 * Returns `true` for null/empty input.
 *
 * NOTE: Canonical implementation lives in src/lib/fallback-images.ts.
 * This re-export uses the same logic for the scraping pipeline.
 * The inline copy in supabase/functions/enrich-sagre/index.ts must be
 * kept in sync manually (Deno import constraint).
 */
import { isLowQualityUrl } from "@/lib/fallback-images";
export { isLowQualityUrl };

/**
 * Detect calendar-spam date ranges (whole month or near-whole month).
 * A range starting on day 1 and ending on day 28+ of any month = calendar spam.
 * Returns `true` if the date range should be REJECTED.
 *
 * Returns `false` for null inputs (cannot determine range).
 */
export function isCalendarDateRange(
  startDate: string | null,
  endDate: string | null
): boolean {
  if (!startDate || !endDate) return false;

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Full-month range: starts on the 1st, ends on the 28th or later
  if (start.getUTCDate() === 1 && end.getUTCDate() >= 28) {
    return true;
  }

  return false;
}

/**
 * Detect events with unreasonable duration.
 * Real sagre last 1-3 days, occasionally up to a week.
 * Returns `true` if the duration exceeds `maxDays` (default 7).
 *
 * Exactly `maxDays` is allowed (not rejected).
 * Returns `false` for null inputs (cannot determine duration).
 */
export function isExcessiveDuration(
  startDate: string | null,
  endDate: string | null,
  maxDays: number = 7
): boolean {
  if (!startDate || !endDate) return false;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays > maxDays;
}

/**
 * Detect events from past years.
 * Uses dynamic year comparison (not hardcoded) so it works across year boundaries.
 * Returns `true` if either start or end date is from a previous year.
 *
 * Returns `false` when both dates are null.
 */
export function isPastYearEvent(
  startDate: string | null,
  endDate: string | null
): boolean {
  const currentYear = new Date().getFullYear();

  if (startDate) {
    const startYear = new Date(startDate).getFullYear();
    if (startYear < currentYear) return true;
  }

  if (endDate) {
    const endYear = new Date(endDate).getFullYear();
    if (endYear < currentYear) return true;
  }

  return false;
}
