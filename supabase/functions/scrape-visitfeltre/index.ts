// =============================================================================
// scrape-visitfeltre — Scrape sagre/feste from visitfeltre.info (WordPress REST API)
// Uses custom post type "evento" with category "manifestazioni" (ID 39).
// Province always "BL" (Feltre is in Belluno).
// Dates/location parsed from HTML content via regex.
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
}

interface DuplicateResult {
  id: string;
  image_url: string | null;
  price_info: string | null;
  is_free: boolean | null;
  sources: string[];
}

interface WPEvento {
  id: number;
  date: string;
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  categoriaevento?: number[];
  featured_media?: number;
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url?: string;
      media_details?: { sizes?: { full?: { source_url?: string }; large?: { source_url?: string } } };
    }>;
  };
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

// --- HTML helpers ---

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
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…");
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// --- Noise / non-sagra filters ---

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

// --- Date extraction from HTML content ---

const MONTH_MAP: Record<string, string> = {
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04",
  maggio: "05", giugno: "06", luglio: "07", agosto: "08",
  settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
  gen: "01", feb: "02", mar: "03", apr: "04",
  mag: "05", giu: "06", lug: "07", ago: "08",
  set: "09", ott: "10", nov: "11", dic: "12",
};

/**
 * Parse Italian date strings from content HTML.
 * Patterns handled:
 *   "23 maggio 2026"
 *   "dal 20 al 25 giugno 2026"
 *   "20-25 giugno 2026"
 *   "20/06/2026"
 *   "2026-06-20"  (ISO)
 */
function extractDatesFromText(text: string): { startDate: string | null; endDate: string | null } {
  let startDate: string | null = null;
  let endDate: string | null = null;

  const currentYear = new Date().getFullYear();

  // Try: "dal DD al DD mese YYYY" or "DD-DD mese YYYY" or "DD e DD mese YYYY"
  const rangePatternSameMonth = /\b(?:dal?\s+)?(\d{1,2})\s*(?:[-–\/]|al\s*|e\s+)(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})?\b/i;
  let m = text.match(rangePatternSameMonth);
  if (m) {
    const day1 = m[1].padStart(2, "0");
    const day2 = m[2].padStart(2, "0");
    const month = MONTH_MAP[m[3].toLowerCase()];
    const year = m[4] || String(currentYear);
    if (month) {
      startDate = `${year}-${month}-${day1}`;
      endDate = `${year}-${month}-${day2}`;
    }
  }

  // Try: "dal DD mese al DD mese YYYY" (different months)
  if (!startDate) {
    const rangePatternDiffMonth = /\b(?:dal?\s+)?(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(?:[-–]|al\s+)(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})?\b/i;
    m = text.match(rangePatternDiffMonth);
    if (m) {
      const day1 = m[1].padStart(2, "0");
      const month1 = MONTH_MAP[m[2].toLowerCase()];
      const day2 = m[3].padStart(2, "0");
      const month2 = MONTH_MAP[m[4].toLowerCase()];
      const year = m[5] || String(currentYear);
      if (month1 && month2) {
        startDate = `${year}-${month1}-${day1}`;
        endDate = `${year}-${month2}-${day2}`;
      }
    }
  }

  // Try: "DD mese YYYY" (single date)
  if (!startDate) {
    const singlePattern = /\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})?\b/i;
    m = text.match(singlePattern);
    if (m) {
      const day = m[1].padStart(2, "0");
      const month = MONTH_MAP[m[2].toLowerCase()];
      const year = m[3] || String(currentYear);
      if (month) {
        startDate = `${year}-${month}-${day}`;
        endDate = startDate;
      }
    }
  }

  // Try: DD/MM/YYYY range "DD/MM/YYYY - DD/MM/YYYY"
  if (!startDate) {
    const slashRange = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/;
    m = text.match(slashRange);
    if (m) {
      startDate = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      endDate = `${m[6]}-${m[5].padStart(2, "0")}-${m[4].padStart(2, "0")}`;
    }
  }

  // Try: single DD/MM/YYYY
  if (!startDate) {
    const slashSingle = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
    m = text.match(slashSingle);
    if (m) {
      startDate = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      endDate = startDate;
    }
  }

  // Try: ISO date YYYY-MM-DD
  if (!startDate) {
    const isoPattern = /(\d{4})-(\d{2})-(\d{2})/;
    m = text.match(isoPattern);
    if (m) {
      startDate = `${m[1]}-${m[2]}-${m[3]}`;
      endDate = startDate;
    }
  }

  return { startDate, endDate };
}

// --- Location extraction from HTML content ---

/**
 * Extract city/location from event content.
 * Looks for patterns like "Feltre", "Luogo: ...", "Dove: ...", "presso ..."
 * Falls back to "Feltre" since this is visitfeltre.info.
 */
function extractLocationFromText(text: string): string {
  // "Luogo:" or "Dove:" or "Location:" patterns
  const luogoMatch = text.match(/(?:luogo|dove|location|sede)\s*[:：]\s*([^\n,]+)/i);
  if (luogoMatch) {
    const loc = luogoMatch[1].trim().replace(/\s+/g, " ");
    // Try to extract just the city name (before any address detail)
    // Often format: "Piazza Maggiore, Feltre" or "Feltre (BL)"
    const cityFromLoc = extractCityName(loc);
    if (cityFromLoc) return cityFromLoc;
    if (loc.length > 3 && loc.length < 80) return loc;
  }

  // "presso" pattern: "presso il Centro Sociale di Feltre"
  const pressoMatch = text.match(/presso\s+(?:il\s+|la\s+|lo\s+|l[''])?(.+?)(?:[,.\n]|$)/i);
  if (pressoMatch) {
    const loc = pressoMatch[1].trim();
    const cityFromPresso = extractCityName(loc);
    if (cityFromPresso) return cityFromPresso;
  }

  // Default to Feltre — this is visitfeltre.info after all
  return "Feltre";
}

/** Try to find a known Feltre-area city name in a string */
function extractCityName(text: string): string | null {
  // Common towns in the Feltre area (provincia di Belluno)
  const feltreAreaTowns = [
    "Feltre", "Pedavena", "Lamon", "Fonzaso", "Seren del Grappa",
    "Sovramonte", "Cesiomaggiore", "Santa Giustina", "Sedico",
    "Belluno", "Mel", "Trichiana", "Limana", "Ponte nelle Alpi",
    "Arsiè", "Quero Vas", "Alano di Piave", "Vas",
    "San Gregorio nelle Alpi", "Rivamonte Agordino",
  ];
  const lower = text.toLowerCase();
  for (const town of feltreAreaTowns) {
    if (lower.includes(town.toLowerCase())) return town;
  }
  return null;
}

// --- HTTP fetch helper (JSON) ---

async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Nemovia/1.0; +https://nemovia.it)",
        "Accept": "application/json",
      },
    });
    if (!resp.ok) {
      console.log(`[visitfeltre] HTTP ${resp.status} for ${url}`);
      return null;
    }
    return await resp.json() as T;
  } catch (err) {
    console.error(`[visitfeltre] Fetch error for ${url}:`, err instanceof Error ? err.message : err);
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
    status:             "pending_geocode",
    content_hash:       event.contentHash,
  };

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
    console.error(`[visitfeltre] Insert error: ${error.message}`);
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
    source_name:     "visitfeltre",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Parse a single WP evento into NormalizedEvent ---

function parseEvento(evento: WPEvento): NormalizedEvent | null {
  // Decode title
  const title = decodeHtmlEntities(evento.title.rendered || "").trim();
  if (!title) return null;

  // Apply filters
  if (isNoiseTitle(title)) {
    console.log(`[visitfeltre] Skipping noise title: "${title}"`);
    return null;
  }
  if (isNonSagraTitle(title)) {
    console.log(`[visitfeltre] Skipping non-sagra title: "${title}"`);
    return null;
  }

  // Get plain text from content
  const contentHtml = evento.content?.rendered || "";
  const contentText = decodeHtmlEntities(stripHtml(contentHtml));

  // Also check excerpt
  const excerptHtml = evento.excerpt?.rendered || "";
  const excerptText = decodeHtmlEntities(stripHtml(excerptHtml));

  const fullText = `${title}\n${contentText}\n${excerptText}`;

  // Apply past year filter
  if (containsPastYear(title, evento.link, contentText)) {
    console.log(`[visitfeltre] Skipping past year: "${title}"`);
    return null;
  }

  // Extract dates from content HTML (dates are embedded in content)
  const { startDate, endDate } = extractDatesFromText(fullText);

  // If no dates found in content, try the WP post date as a rough fallback
  // but only if it's reasonable (some events use the post date as the event date)
  let finalStartDate = startDate;
  let finalEndDate = endDate;

  if (!finalStartDate) {
    // Skip events without any date — we cannot determine when they happen
    console.log(`[visitfeltre] Skipping "${title}" — no date found in content`);
    return null;
  }

  // Skip past events
  const eventEnd = finalEndDate || finalStartDate;
  const today = new Date().toISOString().slice(0, 10);
  if (new Date(eventEnd) < new Date(today)) {
    console.log(`[visitfeltre] Skipping past event: "${title}" (ends ${eventEnd})`);
    return null;
  }

  // Extract location from content
  const city = extractLocationFromText(fullText);

  // Province is always BL (Belluno) — this is visitfeltre.info
  const province = "BL";

  // Build description from content (clean, max 2000 chars)
  let description: string | null = contentText;
  if (description) {
    description = description.replace(/\s+/g, " ").trim();
    if (description.length > 2000) description = description.slice(0, 2000);
    if (description.length < 10) description = null;
  }

  // Extract image URL from _embedded featured media
  let imageUrl: string | null = null;
  const media = evento._embedded?.["wp:featuredmedia"]?.[0];
  if (media) {
    const fullUrl = media.media_details?.sizes?.full?.source_url
      || media.media_details?.sizes?.large?.source_url
      || media.source_url;
    if (fullUrl && !isLowQualityUrl(fullUrl)) {
      imageUrl = fullUrl;
    }
  }

  // If no featured media, try to extract first image from content HTML
  if (!imageUrl) {
    const imgMatch = contentHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && !isLowQualityUrl(imgMatch[1])) {
      imageUrl = imgMatch[1];
    }
  }

  // Price info — look for "gratuito", "ingresso libero", price patterns in content
  let priceInfo: string | null = null;
  let isFree: boolean | null = null;
  const lowerContent = contentText.toLowerCase();
  if (/\b(gratuito|ingresso\s+libero|entrata\s+libera|gratis)\b/i.test(lowerContent)) {
    isFree = true;
    priceInfo = "Ingresso gratuito";
  } else {
    const priceMatch = lowerContent.match(/(?:ingresso|biglietto|costo|prezzo)\s*[:：]?\s*€?\s*(\d+[.,]?\d*)/i);
    if (priceMatch) {
      priceInfo = `€${priceMatch[1]}`;
    }
  }

  return {
    title: title.slice(0, 200),
    normalizedTitle: normalizeText(title),
    slug: generateSlug(title, city),
    city,
    province,
    startDate: finalStartDate,
    endDate: finalEndDate || finalStartDate,
    priceInfo,
    isFree,
    imageUrl,
    url: evento.link,
    sourceDescription: description,
    contentHash: generateContentHash(title, city, finalStartDate),
  };
}

// --- Main scraping logic ---

const API_BASE = "https://visitfeltre.info/wp-json/wp/v2/evento";
const MANIFESTAZIONI_CAT_ID = 39; // "manifestazioni" category
const SOURCE_NAME = "visitfeltre";

async function scrapeVisitfeltre(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  try {
    // Fetch events from WP REST API — filter by manifestazioni category
    // Use _embed to get featured media in a single request
    const apiUrl = `${API_BASE}?per_page=100&categoriaevento=${MANIFESTAZIONI_CAT_ID}&_embed=wp:featuredmedia&orderby=date&order=desc`;
    console.log(`[visitfeltre] Fetching: ${apiUrl}`);

    const eventi = await fetchJson<WPEvento[]>(apiUrl, 20_000);
    if (!eventi || !Array.isArray(eventi)) {
      console.error(`[visitfeltre] Failed to fetch events or empty response`);
      await logRun(supabase, "error", 0, 0, 0, "Failed to fetch WP API", startedAt);
      return;
    }

    console.log(`[visitfeltre] API returned ${eventi.length} eventi (cat=${MANIFESTAZIONI_CAT_ID})`);

    // If we got exactly 100, there might be more pages — fetch page 2
    if (eventi.length === 100) {
      const page2Url = `${apiUrl}&page=2`;
      console.log(`[visitfeltre] Fetching page 2: ${page2Url}`);
      const page2 = await fetchJson<WPEvento[]>(page2Url, 20_000);
      if (page2 && Array.isArray(page2)) {
        eventi.push(...page2);
        console.log(`[visitfeltre] Page 2 returned ${page2.length} more eventi`);
      }
    }

    for (const evento of eventi) {
      // Time budget check (120s total)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[visitfeltre] Time budget exceeded, stopping`);
        break;
      }

      const parsed = parseEvento(evento);
      if (!parsed) continue;

      totalFound++;
      const { result } = await upsertEvent(supabase, parsed, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[visitfeltre] ${result}: "${parsed.title}" (${parsed.city}, ${parsed.province}) [${parsed.startDate}]`);
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, api_results=${eventi.length}`);
    console.log(`[visitfeltre] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[visitfeltre] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-visitfeltre] Starting — scraping visitfeltre.info WP REST API`);

  EdgeRuntime.waitUntil(scrapeVisitfeltre(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "visitfeltre",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
