// =============================================================================
// scrape-cheventi — Scrape sagre from cheventi.it (JSON-LD with GPS coordinates)
// Fetches all 7 Veneto province pages, parses JSON-LD ItemList → Event items.
// Bonus: GPS coordinates included → status starts at pending_llm (skip geocoding).
// =============================================================================

import * as cheerio from "npm:cheerio@1";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// --- Type definitions ---
interface NormalizedEvent {
  title: string;
  normalizedTitle: string;
  slug: string;
  city: string;
  startDate: string | null;
  endDate: string | null;
  priceInfo: string | null;
  isFree: boolean | null;
  imageUrl: string | null;
  url: string | null;
  contentHash: string;
  lat: number | null;
  lng: number | null;
  province: string | null;
}

interface DuplicateResult {
  id: string;
  image_url: string | null;
  price_info: string | null;
  is_free: boolean | null;
  sources: string[];
}

// --- Helper functions (inline copies for Deno edge runtime) ---

const ACCENT_MAP: Record<string, string> = {
  à: "a", á: "a", â: "a", ã: "a", ä: "a", å: "a",
  è: "e", é: "e", ê: "e", ë: "e",
  ì: "i", í: "i", î: "i", ï: "i",
  ò: "o", ó: "o", ô: "o", õ: "o", ö: "o",
  ù: "u", ú: "u", û: "u", ü: "u",
  ñ: "n", ç: "c",
};

function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[àáâãäåèéêëìíîïòóôõöùúûüñç]/g, (c) => ACCENT_MAP[c] ?? c)
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function generateSlug(title: string, city: string): string {
  const normalized = normalizeText(`${title} ${city}`);
  return normalized.replace(/\s+/g, "-");
}

function generateContentHash(title: string, city: string, startDate: string | null): string {
  const input = `${normalizeText(title)}|${normalizeText(city)}|${startDate ?? ""}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    hash = hash >>> 0;
  }
  let hash2 = 0;
  for (let i = input.length - 1; i >= 0; i--) {
    hash2 = ((hash2 << 5) + hash2) ^ input.charCodeAt(i);
    hash2 = hash2 >>> 0;
  }
  return (hash.toString(16).padStart(8, "0") + hash2.toString(16).padStart(8, "0")).slice(0, 12);
}

// --- Noise / non-sagra filters ---

/** Decode HTML entities like &#8211; &#8217; &amp; etc. */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&nbsp;/g, " ");
}

function isNoiseTitle(title: string): boolean {
  if (!title || title.length < 5 || title.length > 150) return true;
  const t = title.toLowerCase();
  if (/calendario\s.*(mensile|regioni|italian)/i.test(t)) return true;
  if (/cookie|privacy\s*policy|termini\s*(e\s*)?condizion/i.test(t)) return true;
  if (/cerca\s+sagr|ricerca\s+event/i.test(t)) return true;
  if (/^(menu|navigazione|home)\b/i.test(t)) return true;
  if (/^[\d\s\-\/\.]+$/.test(title.trim())) return true;
  if (/tutte le sagre|elenco sagre|lista sagre/i.test(t)) return true;
  if (/newsletter|iscriviti|registrati/i.test(t)) return true;
  return false;
}

/**
 * cheventi.it includes ALL event types (concerts, theater, sports, etc.)
 * We want ONLY food-related events: sagre, feste gastronomiche, fiere alimentari.
 * Strategy: whitelist food keywords, then reject known non-food types.
 */
function isFoodEvent(title: string): boolean {
  const t = title.toLowerCase();
  // Whitelist: definitely food-related
  if (/\b(sagra|sagre|festa\s+d[ei]l|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia|salsiccia|castagne|zucca|bisi|carciofi|olio|riso|oca|anatra|bigoli|cinghiale|trippa|lumache|rane|bufala|focaccia|pinza|prosciutt|salame|pasta|pizza|gelato|dolci|tiramisù|fragol|cilieg|mele|uva|miele|pane|fiera\s+d[ei]l)/i.test(t)) {
    return true;
  }
  // Whitelist: generic food terms
  if (/\b(gastronomia|cucina|sapori|gusto|prodotti\s+tipici|street\s*food|food|cibo)\b/i.test(t)) {
    return true;
  }
  return false;
}

// --- Image quality filters ---

const BAD_IMAGE_PATTERNS: RegExp[] = [
  /spacer\.(gif|png)/i, /pixel\.(gif|png)/i, /1x1\.(gif|png|jpg)/i,
  /blank\.(gif|png|jpg)/i, /transparent\.(gif|png)/i,
  /no[-_]?image/i, /no[-_]?photo/i, /no[-_]?pic/i,
  /default[-_]?(image|img|photo|thumb)/i, /placeholder/i,
  /\blogo[-_]?(sito|site|header|footer|main)?\b.*\.(png|jpg|svg|gif|webp)$/i,
  /\bfavicon\b/i, /\bicon[-_]?\d*\.(png|ico|svg)/i,
  /^data:image/i,
];

function isLowQualityUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  for (const pattern of BAD_IMAGE_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  return false;
}

// --- Province code mapping ---

const PROVINCE_MAP: Record<string, string> = {
  belluno: "BL", padova: "PD", rovigo: "RO", treviso: "TV",
  venezia: "VE", verona: "VR", vicenza: "VI",
};

// Province capitals — if location_text is one of these, title might have a better city
const PROVINCE_CAPITALS = new Set([
  "belluno", "padova", "rovigo", "treviso", "venezia", "vicenza", "verona",
]);

/**
 * Extract the actual town/city from the sagra title.
 * Italian patterns:
 *   "Sagra del Radicchio a Creazzo"  → "Creazzo"
 *   "Festa della Zucca di Tribano"   → "Tribano"
 *   "Sagra del Pesce – Caorle"       → "Caorle"
 *   "Festa delle Ciliegie a Zovon di Vò" → "Zovon di Vò"
 *
 * Returns null if no specific town found.
 */
function extractCityFromTitle(title: string): string | null {
  // Pattern 1: "... a CityName" (most reliable — "a" = "at/in")
  // Matches: "a Tribano", "a Zovon di Vò", "a San Giovanni Lupatoto"
  const patternA = title.match(
    /\ba\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:di|del|della|delle|dei|d['']\s*|in|al|sul|sopra|sotto)\s+[A-ZÀ-Ú][a-zà-ú]+)*(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/i
  );
  if (patternA) return patternA[1].trim();

  // Pattern 2: "... – CityName" or "... - CityName" at end of title
  const patternDash = title.match(
    /\s*[–—-]\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:di|del|della|delle|dei|d['']\s*)\s+[A-ZÀ-Ú][a-zà-ú]+)*(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/
  );
  if (patternDash) return patternDash[1].trim();

  // Pattern 3: last "di CityName" when it looks like a location (capitalized, end of title)
  // But NOT "di San Giuseppe" (saint names) unless it's clearly a town
  const patternDi = title.match(
    /\bdi\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:di|del|della|d['']\s*)\s+[A-ZÀ-Ú][a-zà-ú]+)*(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/i
  );
  if (patternDi) {
    const candidate = patternDi[1].trim();
    // Skip saint names and food names that aren't towns
    if (!/^(San\s|Santa\s|Santo\s|S\.\s)/i.test(candidate) || candidate.split(/\s+/).length > 2) {
      return candidate;
    }
  }

  return null;
}

/**
 * If location_text is a generic province name/capital, try to get a more specific
 * city from the title. This prevents all sagre being geocoded to province center.
 */
function refineCityFromTitle(locationText: string, title: string): string {
  const locLower = locationText.toLowerCase().trim();
  // Only refine if location is a province capital (generic)
  if (!PROVINCE_CAPITALS.has(locLower)) return locationText;

  const cityFromTitle = extractCityFromTitle(title);
  if (cityFromTitle && cityFromTitle.toLowerCase() !== locLower) {
    return cityFromTitle;
  }
  return locationText;
}

// --- HTTP fetch helper ---

async function fetchWithTimeout(url: string, timeoutMs = 15_000): Promise<string | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Nemovia/1.0; +https://nemovia.it)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.5",
      },
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

// --- Upsert logic ---

async function upsertEvent(
  supabase: SupabaseClient,
  event: NormalizedEvent,
  sourceName: string
): Promise<{ result: "inserted" | "merged" | "skipped"; id?: string }> {
  const { data: dupes } = await supabase.rpc("find_duplicate_sagra", {
    p_normalized_title: event.normalizedTitle,
    p_city: event.city.toLowerCase(),
    p_start_date: event.startDate,
    p_end_date: event.endDate,
  });

  const existing = (dupes as DuplicateResult[] | null)?.[0];

  if (existing) {
    if (existing.sources?.includes(sourceName)) return { result: "skipped" };

    await supabase.from("sagre").update({
      image_url:  existing.image_url  ?? event.imageUrl,
      price_info: existing.price_info ?? event.priceInfo,
      is_free:    existing.is_free    ?? event.isFree,
      sources:    [...(existing.sources ?? []), sourceName],
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
    return { result: "merged", id: existing.id };
  }

  // cheventi provides GPS coords → skip geocoding, go straight to pending_llm
  const hasCoords = event.lat != null && event.lng != null;

  const insertData: Record<string, unknown> = {
    title:         event.title,
    slug:          event.slug,
    location_text: event.city,
    start_date:    event.startDate,
    end_date:      event.endDate,
    image_url:     event.imageUrl,
    source_url:    event.url,
    price_info:    event.priceInfo,
    is_free:       event.isFree,
    sources:       [sourceName],
    is_active:     false,
    status:        hasCoords ? "pending_llm" : "pending_geocode",
    content_hash:  event.contentHash,
  };

  if (hasCoords) {
    insertData.location = `SRID=4326;POINT(${event.lng} ${event.lat})`;
    insertData.province = event.province;
  }

  const { data: inserted, error } = await supabase.from("sagre")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Slug collision — retry with unique suffix
      insertData.slug = event.slug + "-" + Date.now().toString(36);
      insertData.content_hash = event.contentHash + Date.now().toString(36);
      const { data: retryData } = await supabase.from("sagre")
        .insert(insertData)
        .select("id")
        .single();
      return { result: "inserted", id: retryData?.id };
    }
    console.error(`[cheventi] Insert error: ${error.message}`);
    return { result: "skipped" };
  }
  return { result: "inserted", id: inserted?.id };
}

// --- Logging ---

async function logRun(
  supabase: SupabaseClient,
  status: "success" | "error",
  eventsFound: number,
  eventsInserted: number,
  eventsMerged: number,
  errorMessage: string | null,
  startedAt: number,
  extra?: string
) {
  await supabase.from("scrape_logs").insert({
    source_id:       null,
    source_name:     "cheventi",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- JSON-LD parser for cheventi.it ---

function parseCheventiJsonLd(html: string, provinceName: string): NormalizedEvent[] {
  const $ = cheerio.load(html);
  const events: NormalizedEvent[] = [];
  const provinceCode = PROVINCE_MAP[provinceName] ?? null;

  $('script[type="application/ld+json"]').each((_i: number, el: cheerio.Element) => {
    try {
      const jsonData = JSON.parse($(el).text().trim());
      if (jsonData["@type"] !== "ItemList") return;

      const elements = jsonData.itemListElement || [];
      for (const listItem of elements) {
        // cheventi wraps events in ListItem → item
        const event = listItem["@type"] === "Event"
          ? listItem
          : listItem.item?.["@type"] === "Event"
            ? listItem.item
            : null;

        if (!event) continue;

        const title = decodeHtmlEntities(String(event.name || "").trim());
        if (!title) continue;
        if (isNoiseTitle(title)) continue;

        // cheventi has ALL event types — only keep food events
        if (!isFoodEvent(title)) continue;

        // Extract city from location
        let city = "";
        if (event.location) {
          const loc = event.location;
          city = loc.address?.addressLocality || loc.name || "";
        }
        city = decodeHtmlEntities(city.trim());
        if (!city) city = provinceName;

        // CRITICAL: if city is just the province name (e.g. "Padova"),
        // extract the actual town from the title (e.g. "Festa della Zucca di Tribano" → "Tribano")
        city = refineCityFromTitle(city, title);

        // Extract dates (ISO 8601 → date only)
        let startDate: string | null = null;
        let endDate: string | null = null;
        if (event.startDate) startDate = String(event.startDate).slice(0, 10);
        if (event.endDate) endDate = String(event.endDate).slice(0, 10);

        // Skip past events
        if (startDate) {
          const eventEnd = endDate || startDate;
          if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) continue;
        }

        // Extract GPS coordinates
        let lat: number | null = null;
        let lng: number | null = null;
        const geo = event.location?.geo;
        if (geo) {
          lat = typeof geo.latitude === "number" ? geo.latitude : parseFloat(geo.latitude);
          lng = typeof geo.longitude === "number" ? geo.longitude : parseFloat(geo.longitude);
          if (isNaN(lat) || isNaN(lng)) { lat = null; lng = null; }
          // Validate Italy bounding box
          if (lat != null && lng != null) {
            if (lat < 36 || lat > 47.5 || lng < 6 || lng > 19) { lat = null; lng = null; }
          }
        }

        // Extract image
        let imageUrl: string | null = null;
        if (event.image) {
          if (typeof event.image === "string") imageUrl = event.image;
          else if (Array.isArray(event.image) && event.image.length > 0) imageUrl = event.image[0];
          else if (event.image.url) imageUrl = event.image.url;
        }
        if (isLowQualityUrl(imageUrl)) imageUrl = null;

        // Extract source URL
        let sourceUrl: string | null = event.url || null;
        if (sourceUrl && !sourceUrl.startsWith("http")) {
          sourceUrl = `https://www.cheventi.it${sourceUrl}`;
        }

        // Price info
        const isFree = event.isAccessibleForFree === true
          || event.offers?.price === "0"
          || event.offers?.price === 0;

        events.push({
          title: title.slice(0, 200),
          normalizedTitle: normalizeText(title),
          slug: generateSlug(title, city),
          city,
          startDate,
          endDate: endDate || startDate,
          priceInfo: event.offers?.description || null,
          isFree: isFree || null,
          imageUrl,
          url: sourceUrl,
          contentHash: generateContentHash(title, city, startDate),
          lat,
          lng,
          province: provinceCode,
        });
      }
    } catch {
      // JSON parse error — skip
    }
  });

  return events;
}

// --- Detail scraping: fetch description from cheventi detail pages ---

async function scrapeDetailPages(supabase: SupabaseClient, timeBudgetMs: number): Promise<{ scraped: number; updated: number }> {
  const startedAt = Date.now();
  let scraped = 0;
  let updated = 0;

  // Get cheventi sagre that have source_url but no description yet
  const { data: sagre } = await supabase
    .from("sagre")
    .select("id, source_url")
    .eq("is_active", true)
    .not("source_url", "is", null)
    .is("source_description", null)
    .contains("sources", ["cheventi"])
    .limit(15);

  if (!sagre || sagre.length === 0) return { scraped: 0, updated: 0 };

  for (const sagra of sagre) {
    if (Date.now() - startedAt > timeBudgetMs) break;
    if (!sagra.source_url) continue;

    const html = await fetchWithTimeout(sagra.source_url, 10_000);
    if (!html) continue;
    scraped++;

    const $ = cheerio.load(html);

    // Extract description from .entry-content
    const content = $(".entry-content");
    // Remove scripts, styles, nav elements
    content.find("script, style, nav, .sharedaddy, .jp-relatedposts").remove();
    let description = content.text().trim();

    // Clean up whitespace
    description = description.replace(/\s+/g, " ").trim();

    if (description && description.length > 10) {
      // Truncate to 2000 chars
      if (description.length > 2000) description = description.slice(0, 2000);

      await supabase
        .from("sagre")
        .update({
          source_description: decodeHtmlEntities(description),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sagra.id);
      updated++;
    }

    // Politeness delay
    await new Promise(r => setTimeout(r, 1500));
  }

  return { scraped, updated };
}

// --- Main scraping logic ---

const PROVINCES = ["belluno", "padova", "rovigo", "treviso", "venezia", "vicenza", "verona"];

async function scrapeCheventi(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;

  try {
    for (const province of PROVINCES) {
      const url = `https://www.cheventi.it/regioni/veneto/${province}/`;
      console.log(`[cheventi] Fetching ${province}: ${url}`);

      const html = await fetchWithTimeout(url, 15_000);
      if (!html) {
        console.log(`[cheventi] No HTML for ${province}, skipping`);
        continue;
      }

      const events = parseCheventiJsonLd(html, province);
      console.log(`[cheventi] ${province}: ${events.length} food events found in JSON-LD`);

      for (const event of events) {
        const { result } = await upsertEvent(supabase, event, "cheventi");
        totalFound++;
        if (result === "inserted") totalInserted++;
        else if (result === "merged") totalMerged++;
      }

      // Politeness delay between province pages
      await new Promise(r => setTimeout(r, 1500));
    }

    // Phase 2: Detail scraping (use remaining time budget)
    const elapsed = Date.now() - startedAt;
    const remainingMs = Math.max(0, 90_000 - elapsed); // 90s total budget
    if (remainingMs > 10_000) {
      console.log(`[cheventi] Phase 2: detail scraping (${Math.round(remainingMs / 1000)}s remaining)`);
      const details = await scrapeDetailPages(supabase, remainingMs);
      console.log(`[cheventi] Details: scraped=${details.scraped}, updated=${details.updated}`);
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt);
    console.log(`[cheventi] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[cheventi] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-cheventi] Starting — scraping all 7 Veneto provinces`);

  EdgeRuntime.waitUntil(scrapeCheventi(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      provinces: PROVINCES,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
