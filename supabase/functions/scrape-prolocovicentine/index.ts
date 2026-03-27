// =============================================================================
// scrape-prolocovicentine — Scrape sagre from prolocovicentine.it (UNPLI Vicenza)
// Uses WordPress REST API (category "Eventi" id=6) to fetch event posts.
// Embedded media via ?_embed for featured images.
// Province is always "VI" (Vicenza).
// =============================================================================

import * as cheerio from "npm:cheerio@1";
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
  // Whitelist: food/sagra keywords → keep
  if (
    /\b(sagra|sagre|festa|feste|gastronomic|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia|stand\s+gastronom|piatti?\s+tipic)/i.test(t)
  ) {
    return false;
  }
  // Blacklist: non-food events
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

// --- HTTP fetch helper ---

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
    if (!resp.ok) return null;
    return await resp.json();
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
    console.error(`[prolocovicentine] Insert error: ${error.message}`);
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
    source_name:     "prolocovicentine",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Italian month names for date parsing ---

const ITALIAN_MONTHS: Record<string, string> = {
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04",
  maggio: "05", giugno: "06", luglio: "07", agosto: "08",
  settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
};

/**
 * Try to extract a date from Italian text like "27 aprile 2026", "Sabato 3 e Domenica 4 Agosto",
 * "dal 5 al 7 settembre 2026", etc.
 * Returns { startDate, endDate } in YYYY-MM-DD format.
 */
function extractDatesFromText(text: string): { startDate: string | null; endDate: string | null } {
  if (!text) return { startDate: null, endDate: null };

  const currentYear = new Date().getFullYear();
  const t = text.toLowerCase();

  // Pattern 1: "dal DD al DD mese YYYY" or "dal DD al DD mese"
  const rangeMatch = t.match(
    /dal\s+(\d{1,2})\s+al\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?/
  );
  if (rangeMatch) {
    const [, d1, d2, month, year] = rangeMatch;
    const y = year ?? String(currentYear);
    const m = ITALIAN_MONTHS[month];
    return {
      startDate: `${y}-${m}-${d1.padStart(2, "0")}`,
      endDate: `${y}-${m}-${d2.padStart(2, "0")}`,
    };
  }

  // Pattern 2: "DD e DD mese YYYY" or "DD e DD mese" (e.g. "3 e 4 agosto")
  const andMatch = t.match(
    /(\d{1,2})\s+e\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?/
  );
  if (andMatch) {
    const [, d1, d2, month, year] = andMatch;
    const y = year ?? String(currentYear);
    const m = ITALIAN_MONTHS[month];
    return {
      startDate: `${y}-${m}-${d1.padStart(2, "0")}`,
      endDate: `${y}-${m}-${d2.padStart(2, "0")}`,
    };
  }

  // Pattern 3: "DD mese YYYY" or "DD mese" single date
  const singleMatch = t.match(
    /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?/
  );
  if (singleMatch) {
    const [, day, month, year] = singleMatch;
    const y = year ?? String(currentYear);
    const m = ITALIAN_MONTHS[month];
    const d = `${y}-${m}-${day.padStart(2, "0")}`;
    return { startDate: d, endDate: d };
  }

  // Pattern 4: "domenica DD mese" (weekday prefix)
  const weekdayMatch = t.match(
    /(?:luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?/
  );
  if (weekdayMatch) {
    const [, day, month, year] = weekdayMatch;
    const y = year ?? String(currentYear);
    const m = ITALIAN_MONTHS[month];
    const d = `${y}-${m}-${day.padStart(2, "0")}`;
    return { startDate: d, endDate: d };
  }

  // Pattern 5: ISO-like date DD/MM/YYYY
  const slashMatch = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    const d = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    return { startDate: d, endDate: d };
  }

  return { startDate: null, endDate: null };
}

/**
 * Extract city/location from HTML content.
 * Pro Loco Vicentine posts often mention location in patterns like:
 * "a Montecchio Maggiore", "a Caltrano", "presso Villa X"
 */
function extractCity(text: string): string {
  // Pattern: "a <City>" — match capitalized words after "a " or "ad "
  const aMatch = text.match(
    /\b(?:a|ad)\s+([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+){0,2})(?:\s*[,.\-–(]|\s+con\b|\s+per\b|\s+la\b|\s+il\b|\s+lo\b|\s+le\b|\s+gli\b|\s+un\b|\s+in\b|\s+dalle?\b|\s+del(?:le|lo|la|l')?\b)/
  );
  if (aMatch) return aMatch[1].trim();

  // Pattern: "presso <Location>"
  const pressoMatch = text.match(/\bpresso\s+(?:il\s+|la\s+|lo\s+|l[''])?([A-Z][a-zà-ú]+(?:\s+[A-Za-zà-ú]+){0,3})/);
  if (pressoMatch) return pressoMatch[1].trim();

  // Pattern: "in <Location>"
  const inMatch = text.match(/\bin\s+([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+){0,2})(?:\s*[,.\-–(])/);
  if (inMatch) return inMatch[1].trim();

  return "";
}

/**
 * Check if content mentions free entry.
 */
function checkFreeEntry(text: string): { isFree: boolean | null; priceInfo: string | null } {
  const t = text.toLowerCase();
  if (/ingresso\s+gratuito|entrata\s+gratuita|entrata\s+libera|ingresso\s+libero|gratuito\s+e\s+senza\s+prenotazione/i.test(t)) {
    return { isFree: true, priceInfo: "Ingresso gratuito" };
  }
  return { isFree: null, priceInfo: null };
}

// --- WP REST API post parser ---

interface WpPost {
  id: number;
  date: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  // deno-lint-ignore no-explicit-any
  _embedded?: Record<string, any>;
}

function parseWpPost(post: WpPost): NormalizedEvent | null {
  // Extract and clean title
  const rawTitle = decodeHtmlEntities(post.title.rendered.replace(/<[^>]*>/g, "").trim());
  if (!rawTitle) return null;
  const title = rawTitle.slice(0, 200);

  // Apply filters
  if (isNoiseTitle(title)) {
    console.log(`[prolocovicentine] Skipping noise title: "${title}"`);
    return null;
  }
  if (isNonSagraTitle(title)) {
    console.log(`[prolocovicentine] Skipping non-sagra title: "${title}"`);
    return null;
  }

  // Load content HTML for parsing
  const contentHtml = post.content.rendered || "";
  const $ = cheerio.load(contentHtml);
  const contentText = $.text().trim();

  // Apply past year filter on title + content
  if (containsPastYear(title, post.link, contentText)) {
    console.log(`[prolocovicentine] Skipping past year: "${title}"`);
    return null;
  }

  // Extract dates — first from content text, fallback to post date
  let { startDate, endDate } = extractDatesFromText(contentText);

  // Also try from title (some titles contain dates)
  if (!startDate) {
    const titleDates = extractDatesFromText(title);
    startDate = titleDates.startDate;
    endDate = titleDates.endDate;
  }

  // Fallback: use post publish date (less reliable but better than nothing)
  if (!startDate && post.date) {
    startDate = post.date.slice(0, 10);
    endDate = startDate;
  }

  // Skip past events
  if (startDate) {
    const eventEnd = endDate || startDate;
    if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
      console.log(`[prolocovicentine] Skipping past event: "${title}" (ends ${eventEnd})`);
      return null;
    }
  }

  // Skip events without any date
  if (!startDate) {
    console.log(`[prolocovicentine] Skipping "${title}" — no date available`);
    return null;
  }

  // Extract city from content
  let city = extractCity(contentText);
  // Also try from title if content didn't yield a city
  if (!city) city = extractCity(rawTitle);
  // Default — many Pro Loco Vicentine events are in Vicenza province
  if (!city) city = "Vicenza";

  // Province is always VI for this source
  const province = "VI";

  // Extract description — use content text, cleaned up
  let description: string | null = contentText.replace(/\s+/g, " ").trim();
  if (description.length > 2000) description = description.slice(0, 2000);
  if (description.length < 10) description = null;

  // Extract image — from _embedded featured media
  let imageUrl: string | null = null;
  try {
    const featuredMedia = post._embedded?.["wp:featuredmedia"]?.[0];
    if (featuredMedia) {
      // Prefer medium_large or large size, fallback to source_url
      const sizes = featuredMedia.media_details?.sizes;
      const preferredUrl =
        sizes?.medium_large?.source_url ||
        sizes?.large?.source_url ||
        sizes?.full?.source_url ||
        featuredMedia.source_url;
      if (preferredUrl && !isLowQualityUrl(preferredUrl)) {
        imageUrl = preferredUrl;
      }
    }
  } catch {
    // Embedded media not available
  }

  // Check free entry
  const { isFree, priceInfo } = checkFreeEntry(contentText);

  return {
    title,
    normalizedTitle: normalizeText(title),
    slug: generateSlug(title, city),
    city,
    province,
    startDate,
    endDate: endDate || startDate,
    priceInfo,
    isFree,
    imageUrl,
    url: post.link,
    sourceDescription: description,
    contentHash: generateContentHash(title, city, startDate),
  };
}

// --- Main scraping logic ---

const API_BASE = "https://www.prolocovicentine.it/wp-json/wp/v2/posts";
const CATEGORY_EVENTI = 6; // "Eventi" category
const PER_PAGE = 20;
const MAX_PAGES = 10; // Safety limit: 200 posts max
const SOURCE_NAME = "prolocovicentine";
const DELAY_MS = 1000; // Politeness delay between API pages

async function scrapeProlocoVicentine(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  let totalApiPosts = 0;

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      // Time budget check (120s total)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[prolocovicentine] Time budget exceeded, stopping`);
        break;
      }

      const url = `${API_BASE}?categories=${CATEGORY_EVENTI}&per_page=${PER_PAGE}&page=${page}&orderby=date&order=desc&_embed=wp:featuredmedia`;
      console.log(`[prolocovicentine] Fetching API page ${page}: ${url}`);

      const data = await fetchJson(url, 15_000);
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.log(`[prolocovicentine] No results on page ${page}, stopping pagination`);
        break;
      }

      const posts = data as WpPost[];
      totalApiPosts += posts.length;
      console.log(`[prolocovicentine] Page ${page}: ${posts.length} posts`);

      // Check if the oldest post on this page is too old (> 1 year)
      // to avoid scraping ancient events
      const oldestPostDate = posts[posts.length - 1]?.date;
      if (oldestPostDate) {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (new Date(oldestPostDate) < oneYearAgo) {
          console.log(`[prolocovicentine] Posts older than 1 year on page ${page}, stopping`);
          // Still process this page but don't fetch more
          for (const post of posts) {
            const event = parseWpPost(post);
            if (!event) continue;
            totalFound++;
            const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
            if (result === "inserted") totalInserted++;
            else if (result === "merged") totalMerged++;
            else totalSkipped++;
            console.log(`[prolocovicentine] ${result}: "${event.title}" (${event.city}, ${event.province})`);
          }
          break;
        }
      }

      for (const post of posts) {
        const event = parseWpPost(post);
        if (!event) continue;

        totalFound++;
        const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
        if (result === "inserted") totalInserted++;
        else if (result === "merged") totalMerged++;
        else totalSkipped++;

        console.log(`[prolocovicentine] ${result}: "${event.title}" (${event.city}, ${event.province})`);
      }

      // If fewer posts than per_page, we've reached the end
      if (posts.length < PER_PAGE) {
        console.log(`[prolocovicentine] Last page reached (${posts.length} < ${PER_PAGE})`);
        break;
      }

      // Politeness delay
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, api_posts=${totalApiPosts}`);
    console.log(`[prolocovicentine] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, api_posts=${totalApiPosts}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[prolocovicentine] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-prolocovicentine] Starting — scraping prolocovicentine.it via WP REST API`);

  EdgeRuntime.waitUntil(scrapeProlocoVicentine(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "prolocovicentine",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
