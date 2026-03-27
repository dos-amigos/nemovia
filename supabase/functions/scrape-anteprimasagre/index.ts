// =============================================================================
// scrape-anteprimasagre — Scrape sagre from anteprimasagre.it (WordPress REST API)
// WordPress site covering Veneto (esp. Treviso) + FVG.
// Uses WP REST API /wp-json/wp/v2/posts with province category filters.
// Falls back to Cheerio HTML scraping if API is blocked.
// =============================================================================

import * as cheerio from "npm:cheerio@1";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// --- Type definitions ---
interface NormalizedEvent {
  title: string;
  normalizedTitle: string;
  slug: string;
  city: string;
  province: string | null;
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

// WP REST API post shape (subset)
interface WPPost {
  id: number;
  date: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  featured_media: number;
  categories: number[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url?: string;
      media_details?: { sizes?: Record<string, { source_url: string }> };
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
  // Catch aggregator/listing titles like "Sagre provincia di Pordenone"
  if (/sagre\s+(in\s+)?provincia\s+di/i.test(t)) return true;
  if (/sagre\s+(di|del|della|delle|in|nel|nella)\s+\w+\s+(20\d{2}|nord|sud|est|ovest)/i.test(t)) return true;
  if (/le\s+sagre\s+(in|di|del|della)/i.test(t)) return true;
  if (/^sagre\s+(a|in|di|del)\b/i.test(t)) return true;
  return false;
}

function isNonSagraTitle(title: string): boolean {
  if (!title || title.length === 0) return false;
  const t = title.toLowerCase();
  if (
    /\b(sagra|sagre|festa|feste|gastronomic|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia|mostra del)/i.test(t)
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

// --- Anti-Asian food filter (RULE: enforced on ALL image URLs) ---

const ASIAN_FOOD_REGEX = /\b(asian|sushi|sashimi|chopstick|ramen|chinese|japanese|wok|dim[\s-]?sum|bao|tofu|miso|tempura|teriyaki|wasabi|noodle|pad[\s-]?thai|pho|bibimbap|kimchi|gyoza|udon|soba|dumpling|spring[\s-]?roll|egg[\s-]?roll|stir[\s-]?fry|fried[\s-]?rice|lo[\s-]?mein|chow[\s-]?mein|kung[\s-]?pao|szechuan|sichuan|hoisin|sriracha|samosa|curry|tandoori|tikka|naan|basmati)\b/i;

function isAsianFoodUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return ASIAN_FOOD_REGEX.test(url);
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
  if (isAsianFoodUrl(url)) return true;
  return false;
}

// --- Province mapping ---
// WordPress category IDs for Veneto provinces on anteprimasagre.it
const VENETO_PROVINCE_CATEGORIES: Record<number, string> = {
  1691: "TV",   // Sagre provincia di Treviso (194 posts)
  1703: "VE",   // Sagre provincia di Venezia (103 posts)
  12079: "PD",  // Sagre provincia di Padova (4 posts)
  12203: "VI",  // Sagre provincia di Vicenza (1 post)
};

// All Veneto category IDs for API queries
const VENETO_CATEGORY_IDS = Object.keys(VENETO_PROVINCE_CATEGORIES).map(Number);

const PROVINCE_NAME_TO_CODE: Record<string, string> = {
  belluno: "BL", padova: "PD", rovigo: "RO", treviso: "TV",
  venezia: "VE", vicenza: "VI", verona: "VR",
  bl: "BL", pd: "PD", ro: "RO", tv: "TV",
  ve: "VE", vi: "VI", vr: "VR",
};

function resolveProvince(rawProvince: string | null | undefined): string | null {
  if (!rawProvince) return null;
  const key = rawProvince.trim().toLowerCase();
  return PROVINCE_NAME_TO_CODE[key] ?? null;
}

// Extract province code from post categories or title
function resolveProvinceFromPost(post: WPPost): string | null {
  // First: check category IDs
  for (const catId of post.categories) {
    if (VENETO_PROVINCE_CATEGORIES[catId]) {
      return VENETO_PROVINCE_CATEGORIES[catId];
    }
  }
  // Fallback: extract from title "(TV)", "(VE)", etc.
  const titleMatch = post.title.rendered.match(/\(([A-Z]{2})\)\s*$/);
  if (titleMatch) {
    const code = titleMatch[1];
    if (["BL", "PD", "RO", "TV", "VE", "VI", "VR"].includes(code)) {
      return code;
    }
  }
  return null;
}

// --- Italian date parsing ---

const ITALIAN_MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4,
  maggio: 5, giugno: 6, luglio: 7, agosto: 8,
  settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

/**
 * Parse Italian date ranges from text content.
 * Common patterns on anteprimasagre.it:
 * - "dal 5 al 12 aprile 2026"
 * - "Domenica 8 marzo 2026"
 * - "8 e 9 aprile 2026"
 * - "dal 5 aprile al 3 maggio 2026"
 * - "Sabato 14 e Domenica 15 marzo 2026"
 * - "5, 6 e 7 aprile 2026"
 */
function parseItalianDates(text: string): { startDate: string | null; endDate: string | null } {
  const currentYear = new Date().getFullYear();
  const monthPattern = Object.keys(ITALIAN_MONTHS).join("|");

  // Normalize text: remove bold/strong tags, normalize whitespace
  const clean = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  // Pattern 1: "dal DD mese al DD mese YYYY" (different months)
  const p1 = new RegExp(
    `dal\\s+(\\d{1,2})\\s+(${monthPattern})\\s+al\\s+(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4})`,
    "i"
  );
  const m1 = clean.match(p1);
  if (m1) {
    const [, d1, mo1, d2, mo2, y] = m1;
    return {
      startDate: formatDate(parseInt(d1), ITALIAN_MONTHS[mo1], parseInt(y)),
      endDate: formatDate(parseInt(d2), ITALIAN_MONTHS[mo2], parseInt(y)),
    };
  }

  // Pattern 2: "dal DD al DD mese YYYY" (same month)
  const p2 = new RegExp(
    `dal\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4})`,
    "i"
  );
  const m2 = clean.match(p2);
  if (m2) {
    const [, d1, d2, mo, y] = m2;
    const month = ITALIAN_MONTHS[mo];
    return {
      startDate: formatDate(parseInt(d1), month, parseInt(y)),
      endDate: formatDate(parseInt(d2), month, parseInt(y)),
    };
  }

  // Pattern 3: "DD e DD mese YYYY" or "DD, DD e DD mese YYYY"
  const p3 = new RegExp(
    `(\\d{1,2})(?:[,\\s]+\\d{1,2})*[,\\s]+e\\s+(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4})`,
    "i"
  );
  const m3 = clean.match(p3);
  if (m3) {
    const [, d1, d2, mo, y] = m3;
    const month = ITALIAN_MONTHS[mo];
    return {
      startDate: formatDate(parseInt(d1), month, parseInt(y)),
      endDate: formatDate(parseInt(d2), month, parseInt(y)),
    };
  }

  // Pattern 4: "giorno DD mese YYYY" (single date with day name)
  const dayNames = "(?:luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)";
  const p4 = new RegExp(
    `${dayNames}\\s+(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4})`,
    "i"
  );
  const m4 = clean.match(p4);
  if (m4) {
    const [, d, mo, y] = m4;
    const date = formatDate(parseInt(d), ITALIAN_MONTHS[mo], parseInt(y));
    return { startDate: date, endDate: date };
  }

  // Pattern 5: "DD mese YYYY" (single date without day name)
  const p5 = new RegExp(
    `\\b(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4})\\b`,
    "i"
  );
  const m5 = clean.match(p5);
  if (m5) {
    const [, d, mo, y] = m5;
    const date = formatDate(parseInt(d), ITALIAN_MONTHS[mo], parseInt(y));

    // Check if there's a second date in the text (multi-day event)
    const rest = clean.slice(clean.indexOf(m5[0]) + m5[0].length);
    const p5b = new RegExp(
      `\\b(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4})\\b`,
      "i"
    );
    const m5b = rest.match(p5b);
    if (m5b) {
      const endDate = formatDate(parseInt(m5b[1]), ITALIAN_MONTHS[m5b[2]], parseInt(m5b[3]));
      return { startDate: date, endDate };
    }
    return { startDate: date, endDate: date };
  }

  // Pattern 6: dates without year — assume current year
  const p6 = new RegExp(
    `dal\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+(${monthPattern})`,
    "i"
  );
  const m6 = clean.match(p6);
  if (m6) {
    const [, d1, d2, mo] = m6;
    const month = ITALIAN_MONTHS[mo];
    return {
      startDate: formatDate(parseInt(d1), month, currentYear),
      endDate: formatDate(parseInt(d2), month, currentYear),
    };
  }

  return { startDate: null, endDate: null };
}

function formatDate(day: number, month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// --- City extraction from title ---
// Titles on anteprimasagre.it follow pattern: "Sagra del XYZ a CityName (XX)"
function extractCityFromTitle(title: string): string {
  // Pattern: "... a CityName (XX)" or "... a CityName di SubCity (XX)"
  const match = title.match(/\ba\s+(.+?)\s*\([A-Z]{2}\)\s*$/i);
  if (match) {
    return match[1].trim();
  }
  // Pattern: "... a CityName"
  const match2 = title.match(/\ba\s+([A-Z][a-zà-ú]+(?:\s+(?:di|del|della|delle|dei|degli|in)\s+[A-Z][a-zà-ú]+)*)\s*$/);
  if (match2) {
    return match2[1].trim();
  }
  return "";
}

// --- HTTP fetch helper ---

async function fetchWithTimeout(url: string, timeoutMs = 15_000): Promise<Response | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Nemovia/1.0; +https://nemovia.it)",
        "Accept": "application/json, text/html",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.5",
      },
    });
    if (!resp.ok) return null;
    return resp;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

async function fetchText(url: string, timeoutMs = 15_000): Promise<string | null> {
  const resp = await fetchWithTimeout(url, timeoutMs);
  if (!resp) return null;
  return await resp.text();
}

async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T | null> {
  const resp = await fetchWithTimeout(url, timeoutMs);
  if (!resp) return null;
  try {
    return await resp.json() as T;
  } catch {
    return null;
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
    console.error(`[anteprimasagre] Insert error: ${error.message}`);
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
    source_name:     "anteprimasagre",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Parse a WordPress post into NormalizedEvent ---

function parseWPPost(post: WPPost): NormalizedEvent | null {
  // Decode HTML entities in title
  const rawTitle = decodeHtmlEntities(post.title.rendered.replace(/<[^>]+>/g, "")).trim();
  if (!rawTitle) return null;

  // Clean title: remove trailing province code for display, keep for city extraction
  const title = rawTitle.slice(0, 200);

  // Apply filters
  if (isNoiseTitle(title)) {
    console.log(`[anteprimasagre] Skipping noise title: "${title}"`);
    return null;
  }
  if (isNonSagraTitle(title)) {
    console.log(`[anteprimasagre] Skipping non-sagra title: "${title}"`);
    return null;
  }

  // Extract province from categories or title
  const province = resolveProvinceFromPost(post);
  if (!province) {
    console.log(`[anteprimasagre] Skipping non-Veneto: "${title}"`);
    return null;
  }

  // Extract city from title
  let city = extractCityFromTitle(rawTitle);
  if (!city) {
    // Fallback: try extracting from content
    const contentText = post.content.rendered.replace(/<[^>]+>/g, " ");
    const cityMatch = contentText.match(/\ba\s+([A-Z][a-zà-ú]+(?:\s+(?:di|del)\s+[A-Z][a-zà-ú]+)?)\s*\([A-Z]{2}\)/);
    if (cityMatch) city = cityMatch[1].trim();
  }
  if (!city) city = "";

  // Parse dates from content
  const contentText = post.content.rendered;
  const { startDate, endDate } = parseItalianDates(contentText);

  // Apply past-year and past-event filters
  const description = extractDescription(post);

  if (containsPastYear(title, post.link, description ?? undefined)) {
    console.log(`[anteprimasagre] Skipping past year: "${title}"`);
    return null;
  }

  if (startDate) {
    const eventEnd = endDate || startDate;
    if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
      console.log(`[anteprimasagre] Skipping past event: "${title}" (ends ${eventEnd})`);
      return null;
    }
  }

  // Skip events without any date
  if (!startDate) {
    console.log(`[anteprimasagre] Skipping "${title}" — no date found in content`);
    return null;
  }

  // Extract image URL
  let imageUrl: string | null = null;
  const embedded = post._embedded?.["wp:featuredmedia"]?.[0];
  if (embedded) {
    // Prefer large size, fallback to source_url
    const sizes = embedded.media_details?.sizes;
    imageUrl = sizes?.large?.source_url
      || sizes?.medium_large?.source_url
      || embedded.source_url
      || null;
  }
  // Validate image
  if (isLowQualityUrl(imageUrl)) imageUrl = null;

  return {
    title,
    normalizedTitle: normalizeText(title),
    slug: generateSlug(title, city),
    city,
    province,
    startDate,
    endDate: endDate || startDate,
    priceInfo: null,
    isFree: null,
    imageUrl,
    url: post.link,
    sourceDescription: description,
    contentHash: generateContentHash(title, city, startDate),
    lat: null,
    lng: null,
  };
}

// Extract a clean description from post content (strip HTML, truncate)
function extractDescription(post: WPPost): string | null {
  // Use excerpt if available
  let desc = post.excerpt?.rendered || post.content?.rendered || "";
  // Strip HTML tags
  desc = desc.replace(/<[^>]+>/g, " ");
  // Decode entities
  desc = decodeHtmlEntities(desc);
  // Clean whitespace
  desc = desc.replace(/\s+/g, " ").trim();
  if (desc.length > 2000) desc = desc.slice(0, 2000);
  if (desc.length < 10) return null;
  return desc;
}

// --- WordPress REST API scraping ---

const BASE_API = "https://www.anteprimasagre.it/wp-json/wp/v2/posts";
const SOURCE_NAME = "anteprimasagre";
const DELAY_MS = 1200; // politeness delay
const PER_PAGE = 50;

async function scrapeViaAPI(supabase: SupabaseClient, startedAt: number): Promise<{
  found: number; inserted: number; merged: number; skipped: number; apiWorked: boolean;
}> {
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  // Query each Veneto province category
  for (const catId of VENETO_CATEGORY_IDS) {
    const provinceName = VENETO_PROVINCE_CATEGORIES[catId];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      // Time budget check (120s total)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[anteprimasagre] Time budget exceeded, stopping`);
        hasMore = false;
        break;
      }

      const url = `${BASE_API}?categories=${catId}&per_page=${PER_PAGE}&page=${page}&_embed`;
      console.log(`[anteprimasagre] API fetch: province=${provinceName}, page=${page}`);

      const posts = await fetchJson<WPPost[]>(url, 15_000);
      if (!posts || posts.length === 0) {
        // If first page returns null, API might be blocked
        if (page === 1 && catId === VENETO_CATEGORY_IDS[0]) {
          console.log(`[anteprimasagre] API returned null on first request — may be blocked`);
          return { found: 0, inserted: 0, merged: 0, skipped: 0, apiWorked: false };
        }
        hasMore = false;
        break;
      }

      console.log(`[anteprimasagre] Got ${posts.length} posts for ${provinceName} page ${page}`);

      for (const post of posts) {
        const event = parseWPPost(post);
        if (!event) continue;

        totalFound++;
        const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
        if (result === "inserted") totalInserted++;
        else if (result === "merged") totalMerged++;
        else totalSkipped++;

        console.log(`[anteprimasagre] ${result}: "${event.title}" (${event.city}, ${event.province})`);
      }

      // If fewer than PER_PAGE, no more pages
      if (posts.length < PER_PAGE) {
        hasMore = false;
      } else {
        page++;
      }

      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  return { found: totalFound, inserted: totalInserted, merged: totalMerged, skipped: totalSkipped, apiWorked: true };
}

// --- Cheerio HTML fallback scraping ---

const LISTING_PAGES: Record<string, string> = {
  TV: "https://www.anteprimasagre.it/le-sagre-in-provincia-di-treviso/",
  VE: "https://www.anteprimasagre.it/le-sagre-in-provincia-di-venezia/",
  PD: "https://www.anteprimasagre.it/le-sagre-in-provincia-di-padova/",
  VI: "https://www.anteprimasagre.it/le-sagre-in-provincia-di-vicenza/",
};

async function scrapeViaCheerio(supabase: SupabaseClient, startedAt: number): Promise<{
  found: number; inserted: number; merged: number; skipped: number;
}> {
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  for (const [province, listUrl] of Object.entries(LISTING_PAGES)) {
    if (Date.now() - startedAt > 110_000) {
      console.log(`[anteprimasagre] Time budget exceeded, stopping Cheerio`);
      break;
    }

    console.log(`[anteprimasagre] Cheerio: fetching listing page for ${province}`);
    const html = await fetchText(listUrl, 15_000);
    if (!html) {
      console.log(`[anteprimasagre] Failed to fetch listing page for ${province}`);
      continue;
    }

    const $ = cheerio.load(html);

    // Extract article links from listing page
    const articleLinks: string[] = [];
    $("a[href]").each((_i: number, el: cheerio.Element) => {
      const href = $(el).attr("href");
      if (!href) return;
      if (
        href.startsWith("https://www.anteprimasagre.it/") &&
        !href.includes("/categoria/") &&
        !href.includes("/tag/") &&
        !href.includes("/page/") &&
        !href.includes("/wp-") &&
        !href.includes("/prodotti-e-servizi") &&
        !href.includes("/perche-sceglierci") &&
        href !== "https://www.anteprimasagre.it/" &&
        href !== listUrl
      ) {
        // Likely a post link
        if (!articleLinks.includes(href)) articleLinks.push(href);
      }
    });

    console.log(`[anteprimasagre] Cheerio: found ${articleLinks.length} links for ${province}`);

    // Fetch each article page
    for (const articleUrl of articleLinks.slice(0, 40)) {
      if (Date.now() - startedAt > 110_000) break;

      const articleHtml = await fetchText(articleUrl, 10_000);
      if (!articleHtml) continue;

      const $a = cheerio.load(articleHtml);

      // Extract title
      const rawTitle = decodeHtmlEntities($a("h1.entry-title, h1.wp-block-heading, h1").first().text().trim());
      if (!rawTitle) continue;
      const title = rawTitle.slice(0, 200);

      if (isNoiseTitle(title) || isNonSagraTitle(title)) continue;

      // Extract city
      let city = extractCityFromTitle(rawTitle);
      if (!city) city = "";

      // Parse dates from content
      const contentHtml = $a(".entry-content, article, .post-content").html() || "";
      const { startDate, endDate } = parseItalianDates(contentHtml);

      // Extract description
      let desc = $a(".entry-content, article").text().replace(/\s+/g, " ").trim();
      desc = decodeHtmlEntities(desc);
      if (desc.length > 2000) desc = desc.slice(0, 2000);

      if (containsPastYear(title, articleUrl, desc)) continue;

      if (!startDate) {
        console.log(`[anteprimasagre] Cheerio: skipping "${title}" — no date`);
        continue;
      }

      const eventEnd = endDate || startDate;
      if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) continue;

      // Extract image
      let imageUrl: string | null = $a('meta[property="og:image"]').attr("content") || null;
      if (isLowQualityUrl(imageUrl)) {
        imageUrl = $a(".entry-content img, article img").first().attr("src") || null;
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = `https://www.anteprimasagre.it${imageUrl}`;
        }
        if (isLowQualityUrl(imageUrl)) imageUrl = null;
      }

      const event: NormalizedEvent = {
        title,
        normalizedTitle: normalizeText(title),
        slug: generateSlug(title, city),
        city,
        province,
        startDate,
        endDate: endDate || startDate,
        priceInfo: null,
        isFree: null,
        imageUrl,
        url: articleUrl,
        sourceDescription: desc.length >= 10 ? desc : null,
        contentHash: generateContentHash(title, city, startDate),
        lat: null,
        lng: null,
      };

      totalFound++;
      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[anteprimasagre] Cheerio ${result}: "${title}" (${city}, ${province})`);

      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  return { found: totalFound, inserted: totalInserted, merged: totalMerged, skipped: totalSkipped };
}

// --- Main scraping logic ---

async function scrapeAnteprimasagre(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();

  try {
    // Try WordPress REST API first
    console.log(`[anteprimasagre] Attempting WP REST API...`);
    const apiResult = await scrapeViaAPI(supabase, startedAt);

    let found = apiResult.found;
    let inserted = apiResult.inserted;
    let merged = apiResult.merged;
    let skipped = apiResult.skipped;

    // If API didn't work, fall back to Cheerio
    if (!apiResult.apiWorked) {
      console.log(`[anteprimasagre] API blocked, falling back to Cheerio HTML scraping`);
      const cheerioResult = await scrapeViaCheerio(supabase, startedAt);
      found = cheerioResult.found;
      inserted = cheerioResult.inserted;
      merged = cheerioResult.merged;
      skipped = cheerioResult.skipped;
    }

    const method = apiResult.apiWorked ? "api" : "cheerio";
    await logRun(supabase, "success", found, inserted, merged, null, startedAt,
      `method=${method}, skipped=${skipped}`);
    console.log(`[anteprimasagre] Done (${method}): found=${found}, inserted=${inserted}, merged=${merged}, skipped=${skipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[anteprimasagre] Error:`, errorMessage);
    await logRun(supabase, "error", 0, 0, 0, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-anteprimasagre] Starting — scraping anteprimasagre.it Veneto listings`);

  EdgeRuntime.waitUntil(scrapeAnteprimasagre(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "anteprimasagre",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
