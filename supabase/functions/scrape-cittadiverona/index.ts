// =============================================================================
// scrape-cittadiverona — Scrape sagre from cittadiverona.it (WordPress)
// Tries WP REST API first: /wp-json/wp/v2/lsvr_event/ or /wp-json/wp/v2/posts
// Falls back to HTML scraping: https://cittadiverona.it/eventi/sagre/
// Province always "VR". No GPS coords -> status = pending_geocode.
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

// --- WP REST API post type ---
interface WpPost {
  id?: number;
  title?: { rendered?: string };
  slug?: string;
  link?: string;
  excerpt?: { rendered?: string };
  content?: { rendered?: string };
  date?: string;
  modified?: string;
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>;
  };
  featured_media_url?: string;
  better_featured_image?: { source_url?: string };
  acf?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  // LSVR event fields
  lsvr_event_date?: string;
  lsvr_event_date_end?: string;
  lsvr_event_location?: string;
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
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "\u2026");
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

// --- Anti-Asian food filter (RULE #1: NO CIBO ORIENTALE MAI) ---

const ASIAN_FOOD_REGEX = /\b(sushi|sashimi|ramen|noodle|wok|chopstick|bacchett[eai]|cinese|giapponese|chinese|japanese|korean|coreano|thai|tailandese|vietnamita|vietnamese|dim\s*sum|dumpling|gyoza|tempura|teriyaki|wasabi|tofu|miso|sake|saké|pad\s*thai|pho|bao|udon|soba|yakitori|takoyaki|onigiri|mochi|matcha|bubble\s*tea|asian|asiatico|asiatica|orientale|kimchi|samosa|tandoori|tikka|masala|curry|biryan[ii]|naan|chapati|spring\s*roll|involtini\s*primavera)\b/i;

function containsAsianFood(text: string): boolean {
  return ASIAN_FOOD_REGEX.test(text);
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

async function fetchWithTimeout(url: string, timeoutMs = 15_000): Promise<string | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Nemovia/1.0; +https://nemovia.it)",
        "Accept": "text/html,application/xhtml+xml,application/json",
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

// --- Date parsing helpers ---

const ITALIAN_MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6,
  lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
};

function parseItalianDate(text: string): string | null {
  if (!text) return null;
  const t = text.toLowerCase().trim();

  // ISO format
  const isoMatch = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  // WP date format: "2026-03-27T10:00:00"
  const wpMatch = t.match(/(\d{4}-\d{2}-\d{2})T/);
  if (wpMatch) return wpMatch[1];

  // "27 marzo 2026"
  const italianMatch = t.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\w*\s+(\d{4})/i);
  if (italianMatch) {
    const day = parseInt(italianMatch[1], 10);
    const month = ITALIAN_MONTHS[italianMatch[2].toLowerCase()];
    const year = parseInt(italianMatch[3], 10);
    if (month && day >= 1 && day <= 31 && year >= 2024 && year <= 2030) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // "27/03/2026"
  const ddmmyyyy = t.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10);
    const year = parseInt(ddmmyyyy[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2024 && year <= 2030) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // "27 marzo" (no year — assume current)
  const noYearMatch = t.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/i);
  if (noYearMatch) {
    const day = parseInt(noYearMatch[1], 10);
    const month = ITALIAN_MONTHS[noYearMatch[2].toLowerCase()];
    const year = new Date().getFullYear();
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

function parseDateRange(text: string): [string | null, string | null] {
  if (!text) return [null, null];
  const t = text.trim();

  const parts = t.split(/\s*(?:-|–|—|al|fino\s+al)\s*/i);
  if (parts.length >= 2) {
    const start = parseItalianDate(parts[0]);
    const end = parseItalianDate(parts[parts.length - 1]);
    if (start && end) return [start, end];
    if (start && !end) {
      const endWithYear = parseItalianDate(parts[parts.length - 1] + " " + start.slice(0, 4));
      if (endWithYear) return [start, endWithYear];
    }
  }

  const single = parseItalianDate(t);
  return [single, single];
}

// --- Extract city from title ---

function extractCityFromTitle(title: string): string | null {
  const t = title.trim();
  // Pattern: "... a CityName"
  const patternA = t.match(
    /\ba\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:di|del|della|delle|dei|d['']\s*|in|al)\s+[A-ZÀ-Ú][a-zà-ú]+)*(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/i
  );
  if (patternA) return patternA[1].trim();

  // Pattern: "... – CityName"
  const patternDash = t.match(
    /\s*[–—-]\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:di|del|della|d['']\s*)\s+[A-ZÀ-Ú][a-zà-ú]+)*(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/
  );
  if (patternDash) return patternDash[1].trim();

  // Pattern: "... di CityName" at end
  const patternDi = t.match(
    /\bdi\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/i
  );
  if (patternDi) return patternDi[1].trim();

  return null;
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
      insertData.slug = event.slug + "-" + Date.now().toString(36);
      insertData.content_hash = event.contentHash + Date.now().toString(36);
      const { data: retryData } = await supabase.from("sagre")
        .insert(insertData)
        .select("id")
        .single();
      return { result: "inserted", id: retryData?.id };
    }
    console.error(`[cittadiverona] Insert error: ${error.message}`);
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
    source_name:     "cittadiverona",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- WP REST API scraping ---

const BASE_URL = "https://cittadiverona.it";
const WP_API_ENDPOINTS = [
  `${BASE_URL}/wp-json/wp/v2/lsvr_event?per_page=50&_embed`,
  `${BASE_URL}/wp-json/wp/v2/posts?per_page=50&_embed&categories_exclude=1`, // try generic posts
  `${BASE_URL}/wp-json/wp/v2/tribe_events?per_page=50&_embed`, // The Events Calendar plugin
];

function parseWpPost(post: WpPost): NormalizedEvent | null {
  // Title
  const rawTitle = post.title?.rendered ?? "";
  const title = decodeHtmlEntities(stripHtmlTags(rawTitle)).trim();
  if (!title) return null;

  // Noise/non-sagra/Asian filters
  if (isNoiseTitle(title)) return null;
  if (isNonSagraTitle(title)) return null;
  if (containsAsianFood(title)) return null;

  // Description
  let description: string | null = null;
  const contentHtml = post.content?.rendered ?? post.excerpt?.rendered ?? "";
  if (contentHtml) {
    description = stripHtmlTags(decodeHtmlEntities(contentHtml)).trim();
    if (description.length < 10) description = null;
    if (description && description.length > 2000) description = description.slice(0, 2000);
    if (description && containsAsianFood(description)) return null;
  }

  // Dates
  let startDate: string | null = null;
  let endDate: string | null = null;

  // Try LSVR event fields
  if (post.lsvr_event_date) {
    startDate = parseItalianDate(post.lsvr_event_date);
  }
  if (post.lsvr_event_date_end) {
    endDate = parseItalianDate(post.lsvr_event_date_end);
  }

  // Try ACF custom fields
  if (!startDate && post.acf) {
    const acfDate = post.acf.start_date || post.acf.data_inizio || post.acf.event_date || post.acf.data;
    if (typeof acfDate === "string") startDate = parseItalianDate(acfDate);
    const acfEndDate = post.acf.end_date || post.acf.data_fine || post.acf.event_end_date;
    if (typeof acfEndDate === "string") endDate = parseItalianDate(acfEndDate);
  }

  // Try meta fields
  if (!startDate && post.meta) {
    const metaDate = post.meta._event_start_date || post.meta._EventStartDate || post.meta.start_date;
    if (typeof metaDate === "string") startDate = parseItalianDate(metaDate);
    const metaEndDate = post.meta._event_end_date || post.meta._EventEndDate || post.meta.end_date;
    if (typeof metaEndDate === "string") endDate = parseItalianDate(metaEndDate);
  }

  // Fallback: WP publish date
  if (!startDate && post.date) {
    startDate = parseItalianDate(post.date);
  }

  // Try to extract date from content text
  if (!startDate && description) {
    const [parsedStart, parsedEnd] = parseDateRange(description.slice(0, 500));
    if (parsedStart) {
      startDate = parsedStart;
      if (!endDate && parsedEnd) endDate = parsedEnd;
    }
  }

  if (!startDate) return null;

  // Past year filter
  const sourceUrl = post.link || `${BASE_URL}/?p=${post.id}`;
  if (containsPastYear(title, sourceUrl, description || "")) return null;

  // Skip past events
  const eventEnd = endDate || startDate;
  if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) return null;

  // Image
  let imageUrl: string | null = null;
  if (post._embedded?.["wp:featuredmedia"]?.[0]?.source_url) {
    imageUrl = post._embedded["wp:featuredmedia"][0].source_url;
  } else if (post.featured_media_url) {
    imageUrl = post.featured_media_url;
  } else if (post.better_featured_image?.source_url) {
    imageUrl = post.better_featured_image.source_url;
  }
  if (isLowQualityUrl(imageUrl)) imageUrl = null;

  // City: try to extract from title, location field, or default to "Verona"
  let city = "Verona";
  if (post.lsvr_event_location) {
    city = decodeHtmlEntities(String(post.lsvr_event_location)).trim();
  }
  const cityFromTitle = extractCityFromTitle(title);
  if (cityFromTitle) city = cityFromTitle;

  return {
    title: title.slice(0, 200),
    normalizedTitle: normalizeText(title),
    slug: generateSlug(title, city),
    city,
    province: "VR",
    startDate,
    endDate: endDate || startDate,
    priceInfo: null,
    isFree: null,
    imageUrl,
    url: sourceUrl,
    sourceDescription: description,
    contentHash: generateContentHash(title, city, startDate),
  };
}

// --- HTML fallback scraping ---

function parseHtmlListing(html: string): Array<{ title: string; url: string; imageUrl: string | null; dateText: string; excerpt: string }> {
  const $ = cheerio.load(html);
  const events: Array<{ title: string; url: string; imageUrl: string | null; dateText: string; excerpt: string }> = [];

  // Common WordPress event theme selectors
  const selectors = [
    ".lsvr-event", ".event-item", "article", ".post",
    ".type-lsvr_event", ".type-tribe_events",
    "[class*='event']", ".entry", ".card", ".item",
  ];

  for (const selector of selectors) {
    $(selector).each((_i, el) => {
      const $el = $(el);

      const $link = $el.find("h2 a, h3 a, .entry-title a, .event-title a, a.title").first();
      if (!$link.length) return;

      let title = decodeHtmlEntities(($link.text() || $link.attr("title") || "").trim());
      if (!title || title.length < 5) {
        title = decodeHtmlEntities($el.find("h2, h3, .title").first().text().trim());
      }
      if (!title || title.length < 5) return;
      title = title.replace(/\s+/g, " ").trim();

      let href = $link.attr("href") || "";
      if (!href) return;
      if (!href.startsWith("http")) {
        href = new URL(href, BASE_URL).toString();
      }

      if (isNoiseTitle(title) || isNonSagraTitle(title) || containsAsianFood(title)) return;

      // Image
      const $img = $el.find("img").first();
      let imageUrl = $img.attr("data-src") || $img.attr("data-lazy-src") || $img.attr("src") || null;
      if (imageUrl && !imageUrl.startsWith("http")) {
        imageUrl = new URL(imageUrl, BASE_URL).toString();
      }
      if (isLowQualityUrl(imageUrl)) imageUrl = null;

      // Date
      const dateText = $el.find("[class*='date'], [class*='data'], time, .meta, .event-date").first().text().trim();

      // Excerpt
      const excerpt = $el.find("[class*='excerpt'], [class*='summary'], .entry-content, p").first().text().trim();

      if (!events.some(e => e.url === href)) {
        events.push({
          title,
          url: href,
          imageUrl,
          dateText,
          excerpt: excerpt.slice(0, 500),
        });
      }
    });

    if (events.length > 0) break;
  }

  // JSON-LD fallback
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const jsonData = JSON.parse($(el).text().trim());
      const items = jsonData["@type"] === "ItemList"
        ? (jsonData.itemListElement || [])
        : Array.isArray(jsonData) ? jsonData : [jsonData];

      for (const item of items) {
        const ev = item["@type"] === "Event" ? item : item.item?.["@type"] === "Event" ? item.item : null;
        if (!ev || !ev.name) continue;

        const title = decodeHtmlEntities(String(ev.name).trim());
        if (isNoiseTitle(title) || isNonSagraTitle(title) || containsAsianFood(title)) continue;

        const startDate = ev.startDate ? String(ev.startDate).slice(0, 10) : "";
        let imgUrl: string | null = null;
        if (ev.image) {
          imgUrl = typeof ev.image === "string" ? ev.image : (ev.image.url || (Array.isArray(ev.image) ? ev.image[0] : null));
        }

        const eventUrl = ev.url ? (ev.url.startsWith("http") ? ev.url : BASE_URL + ev.url) : BASE_URL;

        if (!events.some(e => e.url === eventUrl && e.title === title)) {
          events.push({
            title,
            url: eventUrl,
            imageUrl: isLowQualityUrl(imgUrl) ? null : imgUrl,
            dateText: startDate,
            excerpt: ev.description ? String(ev.description).slice(0, 500) : "",
          });
        }
      }
    } catch { /* skip */ }
  });

  return events;
}

function parseDetailPage(html: string): { description: string | null; dateText: string | null; imageUrl: string | null; city: string | null } {
  const $ = cheerio.load(html);

  $("script, style, nav, header, footer, .sidebar, .comments, .related, .share, .social, .cookie, .breadcrumb").remove();

  const contentSelectors = [
    ".entry-content", ".post-content", ".lsvr-event-content",
    ".event-description", ".article-content", ".content",
    "article .text", "#content", "main",
  ];

  let description: string | null = null;
  for (const sel of contentSelectors) {
    const $content = $(sel).first();
    if ($content.length) {
      let text = stripHtmlTags(decodeHtmlEntities($content.html() || ""));
      text = text.replace(/\s+/g, " ").trim();
      if (text.length > 30) {
        description = text.length > 2000 ? text.slice(0, 2000) : text;
        break;
      }
    }
  }

  const dateText = $("[class*='date'], [class*='data'], time, .event-date, [itemprop='startDate']").first().text().trim()
    || $("meta[property='event:start_time']").attr("content")
    || null;

  let imageUrl: string | null = null;
  const $heroImg = $("[class*='featured'] img, .wp-post-image, article img").first();
  if ($heroImg.length) {
    imageUrl = $heroImg.attr("data-src") || $heroImg.attr("src") || null;
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = new URL(imageUrl, BASE_URL).toString();
    }
    if (isLowQualityUrl(imageUrl)) imageUrl = null;
  }

  // Try to find city/location
  let city: string | null = null;
  const locationText = $("[class*='location'], [class*='luogo'], [class*='venue'], [itemprop='location']").first().text().trim();
  if (locationText && locationText.length > 2 && locationText.length < 100) {
    city = decodeHtmlEntities(locationText);
  }

  return { description, dateText, imageUrl, city };
}

// --- Main scraping logic ---

const SOURCE_NAME = "cittadiverona";

async function scrapeCittadiverona(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  let method = "none";

  try {
    // Phase 1: Try WP REST API endpoints
    let wpEvents: NormalizedEvent[] = [];

    for (const apiUrl of WP_API_ENDPOINTS) {
      if (Date.now() - startedAt > 30_000) break;

      console.log(`[cittadiverona] Trying WP API: ${apiUrl}`);
      const data = await fetchJson(apiUrl, 15_000);

      if (data && Array.isArray(data) && data.length > 0) {
        method = "wp-api";
        console.log(`[cittadiverona] WP API returned ${data.length} posts`);

        for (const post of data as WpPost[]) {
          const event = parseWpPost(post);
          if (event) wpEvents.push(event);
        }

        // Try pagination (page 2, 3...)
        for (let page = 2; page <= 5; page++) {
          if (Date.now() - startedAt > 60_000) break;

          const pageUrl = apiUrl + `&page=${page}`;
          console.log(`[cittadiverona] WP API page ${page}: ${pageUrl}`);
          const pageData = await fetchJson(pageUrl, 10_000);
          if (!pageData || !Array.isArray(pageData) || pageData.length === 0) break;

          for (const post of pageData as WpPost[]) {
            const event = parseWpPost(post);
            if (event) wpEvents.push(event);
          }
          await new Promise(r => setTimeout(r, 500));
        }

        break;
      }

      await new Promise(r => setTimeout(r, 500));
    }

    // Process WP API events
    if (wpEvents.length > 0) {
      console.log(`[cittadiverona] WP API: ${wpEvents.length} valid events after filtering`);

      for (const event of wpEvents) {
        totalFound++;
        const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
        if (result === "inserted") totalInserted++;
        else if (result === "merged") totalMerged++;
        else totalSkipped++;

        console.log(`[cittadiverona] ${result}: "${event.title}" (${event.city}, ${event.province})`);
      }
    }

    // Phase 2: HTML fallback if WP API didn't work or returned few results
    if (wpEvents.length < 3) {
      console.log(`[cittadiverona] Trying HTML fallback...`);

      const htmlUrls = [
        `${BASE_URL}/eventi/sagre/`,
        `${BASE_URL}/eventi/`,
        `${BASE_URL}/category/sagre/`,
        `${BASE_URL}/sagre/`,
      ];

      for (const url of htmlUrls) {
        if (Date.now() - startedAt > 80_000) break;

        console.log(`[cittadiverona] Trying HTML: ${url}`);
        const html = await fetchWithTimeout(url, 15_000);
        if (!html) continue;

        const htmlEvents = parseHtmlListing(html);
        if (htmlEvents.length === 0) continue;

        method = method === "wp-api" ? "wp-api+html" : "html";
        console.log(`[cittadiverona] HTML: ${htmlEvents.length} events at ${url}`);

        for (const rawEvent of htmlEvents) {
          if (Date.now() - startedAt > 110_000) break;

          let { title, url: eventUrl, imageUrl, dateText, excerpt } = rawEvent;

          if (containsAsianFood(`${title} ${excerpt}`)) continue;

          let [startDate, endDate] = parseDateRange(dateText);
          let description: string | null = excerpt || null;

          // Fetch detail page if no date
          if (!startDate && eventUrl) {
            console.log(`[cittadiverona] Fetching detail: ${eventUrl}`);
            const detailHtml = await fetchWithTimeout(eventUrl, 10_000);
            if (detailHtml) {
              const detail = parseDetailPage(detailHtml);
              if (detail.dateText) {
                [startDate, endDate] = parseDateRange(detail.dateText);
              }
              if (detail.description) {
                description = detail.description;
                if (containsAsianFood(description)) continue;
              }
              if (!imageUrl && detail.imageUrl) imageUrl = detail.imageUrl;
            }
            await new Promise(r => setTimeout(r, 1500));
          }

          if (!startDate) {
            console.log(`[cittadiverona] Skipping "${title}" -- no date`);
            continue;
          }

          if (containsPastYear(title, eventUrl, description || "")) continue;

          const eventEnd = endDate || startDate;
          if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) continue;

          if (description && description.length > 2000) description = description.slice(0, 2000);

          let city = "Verona";
          const cityFromTitle = extractCityFromTitle(title);
          if (cityFromTitle) city = cityFromTitle;

          const event: NormalizedEvent = {
            title: title.slice(0, 200),
            normalizedTitle: normalizeText(title),
            slug: generateSlug(title, city),
            city,
            province: "VR",
            startDate,
            endDate: endDate || startDate,
            priceInfo: null,
            isFree: null,
            imageUrl,
            url: eventUrl,
            sourceDescription: description,
            contentHash: generateContentHash(title, city, startDate),
          };

          totalFound++;
          const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
          if (result === "inserted") totalInserted++;
          else if (result === "merged") totalMerged++;
          else totalSkipped++;

          console.log(`[cittadiverona] ${result}: "${event.title}" (${event.city}, ${event.province})`);
        }

        break; // Found events, stop trying other URLs
      }
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, method=${method}`);
    console.log(`[cittadiverona] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, method=${method}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[cittadiverona] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-cittadiverona] Starting -- cittadiverona.it WP API + HTML (Verona, VR)`);

  EdgeRuntime.waitUntil(scrapeCittadiverona(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "cittadiverona",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
