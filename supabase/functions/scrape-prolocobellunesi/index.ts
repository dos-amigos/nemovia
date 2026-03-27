// =============================================================================
// scrape-prolocobellunesi — Scrape sagre from prolocobellunesi.it
// Uses WordPress "The Events Calendar" REST API (tribe/events/v1/events).
// Returns structured JSON with dates, venue, organizer, descriptions, images.
// GPS included → status starts at pending_llm (skip geocoding).
// Province is always BL (Belluno).
// =============================================================================

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// --- Type definitions ---
interface NormalizedEvent {
  title: string;
  normalizedTitle: string;
  slug: string;
  city: string;
  province: string;
  startDate: string | null;
  endDate: string | null;
  priceInfo: string | null;
  isFree: boolean | null;
  imageUrl: string | null;
  url: string;
  sourceDescription: string | null;
  contentHash: string;
  lat: number | null;
  lng: number | null;
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
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…");
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

function isNonSagraTitle(title: string): boolean {
  if (!title || title.length === 0) return false;
  const t = title.toLowerCase();
  if (
    /\b(sagra|sagre|festa|feste|gastronomic|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia)/i.test(t)
  ) {
    return false;
  }
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

function containsPastYear(title: string, url?: string, body?: string): boolean {
  const currentYear = new Date().getFullYear();
  const textToCheck = `${title} ${url ?? ""} ${body ?? ""}`;
  const yearMatch = textToCheck.match(/\b(20[0-9]{2})\b/g);
  if (!yearMatch) return false;
  const years = yearMatch.map(Number);
  const hasCurrentOrFuture = years.some(y => y >= currentYear);
  return !hasCurrentOrFuture && years.some(y => y < currentYear);
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

// --- Anti-Asian food filter (REGOLA TASSATIVA N.1) ---

const BANNED_IMAGE_RE = /sushi|chopstick|asian|chinese|japanese|ramen|wok|noodle|dim.?sum|tofu|soy.?sauce|kimchi|thai|vietnamese|korean|oriental|bento|miso|teriyaki|tempura|gyoza|edamame|wasabi|sashimi|udon|pho|curry|pad.?thai|spring.?roll|dumpling/i;

function isAsianFoodImage(url: string | null | undefined): boolean {
  if (!url) return false;
  return BANNED_IMAGE_RE.test(url);
}

// --- Strip HTML tags from description ---

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// --- HTTP fetch helper (JSON) ---

async function fetchJson(url: string, timeoutMs = 15_000): Promise<unknown | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Nemovia/1.0; +https://nemovia.it)",
        "Accept": "application/json",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.5",
      },
    });
    if (!resp.ok) {
      console.log(`[prolocobellunesi] HTTP ${resp.status} for ${url}`);
      return null;
    }
    return await resp.json();
  } catch (err) {
    console.log(`[prolocobellunesi] Fetch error for ${url}: ${err instanceof Error ? err.message : err}`);
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
  // RULE: call find_duplicate_sagra RPC before inserting
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

  // prolocobellunesi provides GPS coords → skip geocoding, go straight to pending_llm
  const hasCoords = event.lat != null && event.lng != null;

  const insertData: Record<string, unknown> = {
    title:              event.title,
    slug:               event.slug,
    location_text:      event.city,
    province:           event.province,
    start_date:         event.startDate,
    end_date:           event.endDate,
    image_url:          event.imageUrl,
    source_url:         event.url,
    source_description: event.sourceDescription,
    price_info:         event.priceInfo,
    is_free:            event.isFree,
    sources:            [sourceName],
    is_active:          false,         // RULE: ALWAYS insert with is_active:false
    status:             hasCoords ? "pending_llm" : "pending_geocode",
    content_hash:       event.contentHash,
  };

  if (hasCoords) {
    insertData.location = `SRID=4326;POINT(${event.lng} ${event.lat})`;
  }

  const { data: inserted, error } = await supabase.from("sagre")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Slug or content_hash collision — retry with unique suffix
      insertData.slug = event.slug + "-" + Date.now().toString(36);
      insertData.content_hash = event.contentHash + Date.now().toString(36);
      const { data: retryData } = await supabase.from("sagre")
        .insert(insertData)
        .select("id")
        .single();
      return { result: "inserted", id: retryData?.id };
    }
    console.error(`[prolocobellunesi] Insert error: ${error.message}`);
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
    source_name:     "prolocobellunesi",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- WordPress Events Calendar API parser ---

interface TribeEvent {
  id: number;
  url: string;
  title: string;
  description: string;
  start_date: string;       // "2026-04-15 10:00:00"
  end_date: string;         // "2026-04-15 22:00:00"
  start_date_details: { year: string; month: string; day: string };
  end_date_details: { year: string; month: string; day: string };
  image?: { url?: string; sizes?: Record<string, { url?: string }> };
  venue?: {
    venue: string;
    city: string;
    province: string;
    address: string;
    geo_lat?: number;
    geo_lng?: number;
  };
  organizer?: Array<{ organizer: string }>;
  cost?: string;
  cost_details?: { values?: string[]; currency_symbol?: string };
  categories?: Array<{ name: string; slug: string }>;
}

interface TribeApiResponse {
  events: TribeEvent[];
  total: number;
  total_pages: number;
  next_rest_url?: string;
}

function parseApiEvent(event: TribeEvent): NormalizedEvent | null {
  // Extract title — API returns rendered HTML title
  const rawTitle = decodeHtmlEntities(stripHtml(event.title || "").trim());
  if (!rawTitle) return null;

  // Apply filters
  if (isNoiseTitle(rawTitle)) {
    console.log(`[prolocobellunesi] Skipping noise title: "${rawTitle}"`);
    return null;
  }
  if (isNonSagraTitle(rawTitle)) {
    console.log(`[prolocobellunesi] Skipping non-sagra title: "${rawTitle}"`);
    return null;
  }

  // Extract dates (YYYY-MM-DD from "2026-04-15 10:00:00" format)
  let startDate: string | null = null;
  let endDate: string | null = null;

  if (event.start_date) {
    startDate = event.start_date.slice(0, 10);
  } else if (event.start_date_details) {
    const d = event.start_date_details;
    startDate = `${d.year}-${d.month.padStart(2, "0")}-${d.day.padStart(2, "0")}`;
  }

  if (event.end_date) {
    endDate = event.end_date.slice(0, 10);
  } else if (event.end_date_details) {
    const d = event.end_date_details;
    endDate = `${d.year}-${d.month.padStart(2, "0")}-${d.day.padStart(2, "0")}`;
  }

  // Skip events without any date
  if (!startDate) {
    console.log(`[prolocobellunesi] Skipping "${rawTitle}" — no date available`);
    return null;
  }

  // Skip past events
  const eventEnd = endDate || startDate;
  if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
    console.log(`[prolocobellunesi] Skipping past event: "${rawTitle}" (ends ${eventEnd})`);
    return null;
  }

  // Extract description
  let description: string | null = null;
  if (event.description) {
    description = decodeHtmlEntities(stripHtml(event.description).trim());
    if (description.length > 2000) description = description.slice(0, 2000);
    if (description.length < 10) description = null;
  }

  // Apply past year filter
  if (containsPastYear(rawTitle, event.url, description ?? undefined)) {
    console.log(`[prolocobellunesi] Skipping past year: "${rawTitle}"`);
    return null;
  }

  // Extract location — province is ALWAYS BL for this source
  const venue = event.venue;
  let city = "";
  if (venue) {
    city = (venue.city || venue.venue || "").trim();
    // If city contains venue name with address, clean up
    if (!city && venue.address) {
      city = venue.address.split(",")[0].trim();
    }
  }
  if (!city) city = "Belluno"; // fallback — it's always Belluno province

  city = decodeHtmlEntities(city);

  // Extract GPS coordinates
  let lat: number | null = null;
  let lng: number | null = null;
  if (venue?.geo_lat != null && venue?.geo_lng != null) {
    lat = typeof venue.geo_lat === "number" ? venue.geo_lat : parseFloat(String(venue.geo_lat));
    lng = typeof venue.geo_lng === "number" ? venue.geo_lng : parseFloat(String(venue.geo_lng));
    if (isNaN(lat) || isNaN(lng)) { lat = null; lng = null; }
    // Validate Veneto/Belluno bounding box (roughly lat 45.8-46.8, lng 11.4-12.6)
    // Use wider Veneto box for safety
    if (lat != null && lng != null) {
      if (lat < 44.5 || lat > 47.0 || lng < 10.0 || lng > 13.5) {
        console.log(`[prolocobellunesi] Coords outside Veneto for "${rawTitle}": ${lat}, ${lng} — clearing`);
        lat = null;
        lng = null;
      }
    }
  }

  // Extract image
  let imageUrl: string | null = null;
  if (event.image?.url) {
    imageUrl = event.image.url;
  } else if (event.image?.sizes) {
    // Try to get medium or large size
    const sizes = event.image.sizes;
    const preferred = sizes["medium_large"] ?? sizes["large"] ?? sizes["medium"] ?? sizes["thumbnail"];
    if (preferred?.url) imageUrl = preferred.url;
  }

  // Validate image
  if (isLowQualityUrl(imageUrl)) imageUrl = null;
  if (isAsianFoodImage(imageUrl)) {
    console.log(`[prolocobellunesi] Blocked Asian food image: ${imageUrl}`);
    imageUrl = null;
  }

  // Price info
  let priceInfo: string | null = null;
  let isFree: boolean | null = null;
  if (event.cost) {
    const costLower = event.cost.toLowerCase().trim();
    if (costLower === "free" || costLower === "gratis" || costLower === "gratuito" || costLower === "ingresso libero") {
      isFree = true;
      priceInfo = "Ingresso gratuito";
    } else if (costLower && costLower !== "" && costLower !== "non specificato") {
      priceInfo = decodeHtmlEntities(event.cost.trim());
    }
  }

  // Source URL
  const sourceUrl = event.url || `https://prolocobellunesi.it/?post_type=tribe_events&p=${event.id}`;

  const title = rawTitle.slice(0, 200);

  return {
    title,
    normalizedTitle: normalizeText(title),
    slug: generateSlug(title, city),
    city,
    province: "BL", // ALWAYS Belluno for this source
    startDate,
    endDate: endDate || startDate,
    priceInfo,
    isFree,
    imageUrl,
    url: sourceUrl,
    sourceDescription: description,
    contentHash: generateContentHash(title, city, startDate),
    lat,
    lng,
  };
}

// --- Main scraping logic ---

const API_BASE = "https://prolocobellunesi.it/wp-json/tribe/events/v1/events";
const MAX_PAGES = 5;
const SOURCE_NAME = "prolocobellunesi";
const PER_PAGE = 50;
const DELAY_MS = 1000; // politeness delay between API pages

async function scrapeProlocoBellunesi(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  let totalFiltered = 0;

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      // Time budget check (120s total for edge function)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[prolocobellunesi] Time budget exceeded at page ${page}, stopping`);
        break;
      }

      const apiUrl = `${API_BASE}?per_page=${PER_PAGE}&page=${page}&start_date=now&status=publish`;
      console.log(`[prolocobellunesi] Fetching API page ${page}: ${apiUrl}`);

      const data = await fetchJson(apiUrl, 15_000) as TribeApiResponse | null;
      if (!data || !data.events || data.events.length === 0) {
        console.log(`[prolocobellunesi] No events on page ${page}, stopping pagination`);
        break;
      }

      console.log(`[prolocobellunesi] Page ${page}: ${data.events.length} events (total_pages: ${data.total_pages}, total: ${data.total})`);

      for (const apiEvent of data.events) {
        const event = parseApiEvent(apiEvent);
        if (!event) {
          totalFiltered++;
          continue;
        }

        totalFound++;
        const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
        if (result === "inserted") totalInserted++;
        else if (result === "merged") totalMerged++;
        else totalSkipped++;

        console.log(`[prolocobellunesi] ${result}: "${event.title}" (${event.city}, ${event.province})`);
      }

      // Stop if we've reached the last page
      if (page >= (data.total_pages || 1)) {
        console.log(`[prolocobellunesi] Reached last page (${data.total_pages})`);
        break;
      }

      // Politeness delay between API pages
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, filtered=${totalFiltered}`);
    console.log(`[prolocobellunesi] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, filtered=${totalFiltered}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[prolocobellunesi] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-prolocobellunesi] Starting — scraping prolocobellunesi.it via WordPress Events API`);

  EdgeRuntime.waitUntil(scrapeProlocoBellunesi(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "prolocobellunesi",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
