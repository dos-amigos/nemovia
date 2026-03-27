// =============================================================================
// scrape-paesiinfesta — Scrape sagre from paesiinfesta.com (WordPress)
// Tries WP REST API first: /wp-json/wp/v2/posts?categories=<sagre_cat>&per_page=50
// Falls back to HTML scraping: https://paesiinfesta.com/sagre/
// Covers Veneto orientale (VE/TV border area).
// No GPS → status = pending_geocode.
// =============================================================================

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
  // Featured image (if _embed is used)
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>;
  };
  // Direct featured media URL (some WP configs)
  featured_media_url?: string;
  better_featured_image?: { source_url?: string };
  // ACF or custom fields
  acf?: Record<string, unknown>;
  meta?: Record<string, unknown>;
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

const ASIAN_FOOD_REGEX = /\b(sushi|sashimi|ramen|noodle|wok|chopstick|bacchett[eai]|cinese|giapponese|asian|asiatico|asiatica|chinese|japanese|thai|dim\s*sum|tempura|gyoza|udon|pho|bibimbap|kimchi|teriyaki|wasabi|miso|tofu|pad\s*thai|satay|curry|tandoori|naan|samosa|dumpling|bao|spring\s*roll|involtini\s*primavera|edamame|sake|matcha|bubble\s*tea|bento|onigiri|takoyaki|okonomiyaki)\b/i;

function isLowQualityUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  for (const pattern of BAD_IMAGE_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  return false;
}

function isAsianFoodImage(url: string | null | undefined): boolean {
  if (!url) return false;
  return ASIAN_FOOD_REGEX.test(url);
}

// --- Province mapping ---

const PROVINCE_NAME_TO_CODE: Record<string, string> = {
  belluno: "BL", padova: "PD", rovigo: "RO", treviso: "TV",
  venezia: "VE", vicenza: "VI", verona: "VR",
  bl: "BL", pd: "PD", ro: "RO", tv: "TV",
  ve: "VE", vi: "VI", vr: "VR",
  "provincia di belluno": "BL", "provincia di padova": "PD",
  "provincia di rovigo": "RO", "provincia di treviso": "TV",
  "provincia di venezia": "VE", "provincia di vicenza": "VI",
  "provincia di verona": "VR",
};

function resolveProvince(rawProvince: string | null | undefined): string | null {
  if (!rawProvince) return null;
  const key = rawProvince.trim().toLowerCase();
  return PROVINCE_NAME_TO_CODE[key] ?? null;
}

// --- Italian date parsing ---

const ITALIAN_MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6,
  lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
};

function parseItalianDate(text: string): string | null {
  const monthNameMatch = text.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\.?\s*(\d{4})?/i);
  if (monthNameMatch) {
    const day = parseInt(monthNameMatch[1], 10);
    const month = ITALIAN_MONTHS[monthNameMatch[2].toLowerCase()];
    const year = monthNameMatch[3] ? parseInt(monthNameMatch[3], 10) : new Date().getFullYear();
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const numMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (numMatch) {
    const day = parseInt(numMatch[1], 10);
    const month = parseInt(numMatch[2], 10);
    const year = parseInt(numMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

function parseDateRange(text: string): [string | null, string | null] {
  // "dal DD mese al DD mese YYYY"
  const rangeMatch = text.match(/dal\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+al\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})?/i);
  if (rangeMatch) {
    const year = rangeMatch[5] ? parseInt(rangeMatch[5], 10) : new Date().getFullYear();
    const startMonth = ITALIAN_MONTHS[rangeMatch[2].toLowerCase()];
    const endMonth = ITALIAN_MONTHS[rangeMatch[4].toLowerCase()];
    if (startMonth && endMonth) {
      const sd = `${year}-${String(startMonth).padStart(2, "0")}-${String(parseInt(rangeMatch[1], 10)).padStart(2, "0")}`;
      const ed = `${year}-${String(endMonth).padStart(2, "0")}-${String(parseInt(rangeMatch[3], 10)).padStart(2, "0")}`;
      return [sd, ed];
    }
  }

  // "dal DD al DD mese YYYY"
  const samMonthRange = text.match(/dal\s+(\d{1,2})\s+al\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})?/i);
  if (samMonthRange) {
    const year = samMonthRange[4] ? parseInt(samMonthRange[4], 10) : new Date().getFullYear();
    const month = ITALIAN_MONTHS[samMonthRange[3].toLowerCase()];
    if (month) {
      const sd = `${year}-${String(month).padStart(2, "0")}-${String(parseInt(samMonthRange[1], 10)).padStart(2, "0")}`;
      const ed = `${year}-${String(month).padStart(2, "0")}-${String(parseInt(samMonthRange[2], 10)).padStart(2, "0")}`;
      return [sd, ed];
    }
  }

  // DD/MM/YYYY - DD/MM/YYYY
  const numRangeMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*[-–]\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (numRangeMatch) {
    const sd = `${numRangeMatch[3]}-${numRangeMatch[2].padStart(2, "0")}-${numRangeMatch[1].padStart(2, "0")}`;
    const ed = `${numRangeMatch[6]}-${numRangeMatch[5].padStart(2, "0")}-${numRangeMatch[4].padStart(2, "0")}`;
    return [sd, ed];
  }

  const single = parseItalianDate(text);
  if (single) return [single, single];

  return [null, null];
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
    console.error(`[paesiinfesta] Insert error: ${error.message}`);
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
    source_name:     "paesiinfesta",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Fetch helpers ---

async function fetchJson(url: string): Promise<unknown> {
  console.log(`[paesiinfesta] Fetching JSON: ${url}`);
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 20_000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Nemovia/1.0; +https://nemovia.it)",
        "Accept": "application/json",
      },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(tid);
  }
}

async function fetchHtml(url: string): Promise<string> {
  console.log(`[paesiinfesta] Fetching HTML: ${url}`);
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 25_000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Nemovia/1.0; +https://nemovia.it)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(tid);
  }
}

// --- Extract city and province from text ---

function extractCityProvince(text: string): { city: string; province: string | null } {
  // Try "(VE)", "(TV)" etc.
  const provCodeMatch = text.match(/\(([A-Z]{2})\)/);
  let province: string | null = null;
  if (provCodeMatch) {
    province = resolveProvince(provCodeMatch[1]);
  }

  // Try "CityName (VE)" pattern
  const cityProvMatch = text.match(/([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*\([A-Z]{2}\)/);
  if (cityProvMatch) {
    return { city: cityProvMatch[1].trim(), province };
  }

  // Try "a CityName" or "di CityName" at end of title
  const aCityMatch = text.match(/\s+(?:a|di|in)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/);
  if (aCityMatch) {
    return { city: aCityMatch[1].trim(), province };
  }

  // Try common VE/TV border cities
  const vetvCities = /\b(San Donà di Piave|Jesolo|Portogruaro|Caorle|Eraclea|Musile di Piave|Noventa di Piave|Ceggia|Torre di Mosto|Fossalta di Piave|Meolo|Quarto d'Altino|Concordia Sagittaria|Annone Veneto|Pramaggiore|Gruaro|Teglio Veneto|Fossalta di Portogruaro|Santo Stino di Livenza|Motta di Livenza|Oderzo|San Polo di Piave|Gorgo al Monticano|Cessalto|Chiarano|Meduna di Livenza|Ponte di Piave)\b/i;
  const cityMatch = text.match(vetvCities);
  if (cityMatch) {
    const cityName = cityMatch[1].trim();
    // Determine province by known geography
    const tvCities = ["motta di livenza", "oderzo", "san polo di piave", "gorgo al monticano", "cessalto", "chiarano", "meduna di livenza", "ponte di piave"];
    if (!province) {
      province = tvCities.includes(cityName.toLowerCase()) ? "TV" : "VE";
    }
    return { city: cityName, province };
  }

  return { city: "", province };
}

// --- Parse WP REST API posts ---

function parseWpPost(post: WpPost): NormalizedEvent | null {
  const rawTitle = post.title?.rendered ?? "";
  const title = decodeHtmlEntities(stripHtmlTags(rawTitle)).trim();
  if (!title) return null;

  if (isNoiseTitle(title)) {
    console.log(`[paesiinfesta] Skipping noise title: "${title}"`);
    return null;
  }
  if (isNonSagraTitle(title)) {
    console.log(`[paesiinfesta] Skipping non-sagra title: "${title}"`);
    return null;
  }

  const sourceUrl = post.link || `https://paesiinfesta.com/?p=${post.id ?? 0}`;

  // Extract content text
  const contentHtml = post.content?.rendered || post.excerpt?.rendered || "";
  const contentText = stripHtmlTags(decodeHtmlEntities(contentHtml)).trim();

  if (containsPastYear(title, sourceUrl, contentText)) {
    console.log(`[paesiinfesta] Skipping past year: "${title}"`);
    return null;
  }

  // Extract city/province from title and content
  let { city, province } = extractCityProvince(title);
  if (!city) {
    const fromContent = extractCityProvince(contentText);
    city = fromContent.city;
    if (!province) province = fromContent.province;
  }
  if (!city) city = "Veneto orientale";

  // Parse dates from content
  const [startDate, endDate] = parseDateRange(`${title} ${contentText}`);

  // If no dates from content, try the WP post date as rough fallback
  let fallbackDate: string | null = null;
  if (!startDate && post.date) {
    const d = new Date(post.date);
    if (!isNaN(d.getTime())) {
      fallbackDate = d.toISOString().slice(0, 10);
    }
  }

  const finalStartDate = startDate || fallbackDate;
  const finalEndDate = endDate || finalStartDate;

  // Skip past events
  if (finalStartDate) {
    const eventEnd = finalEndDate || finalStartDate;
    if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
      console.log(`[paesiinfesta] Skipping past event: "${title}" (ends ${eventEnd})`);
      return null;
    }
  }

  // Image
  let imageUrl: string | null = null;
  const embeddedMedia = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
  const directMedia = post.featured_media_url || post.better_featured_image?.source_url;
  const imgCandidate = embeddedMedia || directMedia || null;

  if (imgCandidate && !isLowQualityUrl(imgCandidate) && !isAsianFoodImage(imgCandidate)) {
    imageUrl = imgCandidate;
  }

  // Also try to find image in content HTML
  if (!imageUrl && contentHtml) {
    const imgMatch = contentHtml.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
    if (imgMatch && !isLowQualityUrl(imgMatch[1]) && !isAsianFoodImage(imgMatch[1])) {
      imageUrl = imgMatch[1];
    }
  }

  const sourceDescription = contentText.length > 10 ? contentText.slice(0, 2000) : null;

  return {
    title: title.slice(0, 200),
    normalizedTitle: normalizeText(title),
    slug: generateSlug(title, city),
    city,
    province,
    startDate: finalStartDate,
    endDate: finalEndDate,
    priceInfo: null,
    isFree: null,
    imageUrl,
    url: sourceUrl,
    sourceDescription,
    contentHash: generateContentHash(title, city, finalStartDate),
  };
}

// --- Parse HTML listing (fallback) ---

function parseHtmlListing(html: string): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const seenTitles = new Set<string>();
  const baseUrl = "https://paesiinfesta.com";

  // Try to find event/post blocks
  const blockPattern = /<(?:article|div|li)[^>]*class="[^"]*(?:post|entry|event|hentry|type-post)[^"]*"[^>]*>([\s\S]*?)<\/(?:article|div|li)>/gi;
  const blocks: string[] = [];
  let match;

  while ((match = blockPattern.exec(html)) !== null) {
    blocks.push(match[1]);
  }

  // Fallback: try <h2><a> pattern common in WP archive pages
  if (blocks.length === 0) {
    const headingLinkPattern = /<h[2-3][^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/h[2-3]>/gi;
    while ((match = headingLinkPattern.exec(html)) !== null) {
      blocks.push(match[0]);
    }
  }

  for (const block of blocks) {
    let title = "";
    let link = "";

    const headingMatch = block.match(/<h[2-4][^>]*>\s*(?:<a[^>]*href="([^"]*)"[^>]*>)?([\s\S]*?)(?:<\/a>)?\s*<\/h[2-4]>/i);
    if (headingMatch) {
      link = headingMatch[1] || "";
      title = stripHtmlTags(decodeHtmlEntities(headingMatch[2])).trim();
    }

    if (!title) {
      const linkMatch = block.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (linkMatch) {
        link = linkMatch[1];
        title = stripHtmlTags(decodeHtmlEntities(linkMatch[2])).trim();
      }
    }

    if (!title || title.length < 5) continue;

    const eventUrl = link
      ? (link.startsWith("http") ? link : `${baseUrl}${link.startsWith("/") ? "" : "/"}${link}`)
      : `${baseUrl}/sagre/`;

    if (isNoiseTitle(title)) continue;
    if (isNonSagraTitle(title)) continue;

    const blockText = stripHtmlTags(decodeHtmlEntities(block)).trim();
    if (containsPastYear(title, eventUrl, blockText)) continue;

    const normTitle = normalizeText(title);
    if (seenTitles.has(normTitle)) continue;
    seenTitles.add(normTitle);

    let { city, province } = extractCityProvince(title);
    if (!city) {
      const fromBlock = extractCityProvince(blockText);
      city = fromBlock.city;
      if (!province) province = fromBlock.province;
    }
    if (!city) city = "Veneto orientale";

    const [startDate, endDate] = parseDateRange(blockText);

    if (startDate) {
      const eventEnd = endDate || startDate;
      if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) continue;
    }

    let imageUrl: string | null = null;
    const imgMatch = block.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
    if (imgMatch && !isLowQualityUrl(imgMatch[1]) && !isAsianFoodImage(imgMatch[1])) {
      let src = imgMatch[1];
      if (!src.startsWith("http")) src = `${baseUrl}${src.startsWith("/") ? "" : "/"}${src}`;
      imageUrl = src;
    }

    events.push({
      title: title.slice(0, 200),
      normalizedTitle: normTitle,
      slug: generateSlug(title, city),
      city,
      province,
      startDate,
      endDate: endDate || startDate,
      priceInfo: null,
      isFree: null,
      imageUrl,
      url: eventUrl,
      sourceDescription: blockText.length > 10 ? blockText.slice(0, 2000) : null,
      contentHash: generateContentHash(title, city, startDate),
    });
  }

  return events;
}

// --- Try to discover the correct WP category for sagre ---

async function discoverSagreCategory(): Promise<number | null> {
  try {
    const data = await fetchJson("https://paesiinfesta.com/wp-json/wp/v2/categories?per_page=100&search=sagr") as Array<{ id: number; name: string; slug: string }>;
    if (Array.isArray(data)) {
      for (const cat of data) {
        if (/sagr/i.test(cat.name) || /sagr/i.test(cat.slug)) {
          console.log(`[paesiinfesta] Found sagre category: id=${cat.id}, name="${cat.name}"`);
          return cat.id;
        }
      }
    }
  } catch (err) {
    console.log(`[paesiinfesta] Category discovery failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Also try "feste" category
  try {
    const data = await fetchJson("https://paesiinfesta.com/wp-json/wp/v2/categories?per_page=100&search=fest") as Array<{ id: number; name: string; slug: string }>;
    if (Array.isArray(data)) {
      for (const cat of data) {
        if (/fest[eai]/i.test(cat.name) || /fest[eai]/i.test(cat.slug)) {
          console.log(`[paesiinfesta] Found feste category: id=${cat.id}, name="${cat.name}"`);
          return cat.id;
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

// --- Main scraping logic ---

const SOURCE_NAME = "paesiinfesta";

async function scrapePaesiinfesta(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  let method = "unknown";

  try {
    const allEvents: NormalizedEvent[] = [];
    const seenTitles = new Set<string>();

    // --- Strategy 1: WP REST API ---
    let wpApiWorked = false;
    try {
      // First discover the sagre/feste category ID
      const categoryId = await discoverSagreCategory();

      const apiUrls: string[] = [];
      if (categoryId) {
        apiUrls.push(`https://paesiinfesta.com/wp-json/wp/v2/posts?categories=${categoryId}&per_page=50&_embed=1`);
        apiUrls.push(`https://paesiinfesta.com/wp-json/wp/v2/posts?categories=${categoryId}&per_page=50&_embed=1&page=2`);
      }
      // Also try without category filter (will get all posts, filter by title)
      apiUrls.push("https://paesiinfesta.com/wp-json/wp/v2/posts?per_page=50&_embed=1&search=sagra");
      apiUrls.push("https://paesiinfesta.com/wp-json/wp/v2/posts?per_page=50&_embed=1&search=festa");

      for (const apiUrl of apiUrls) {
        if (Date.now() - startedAt > 60_000) break;
        try {
          const data = await fetchJson(apiUrl);
          if (Array.isArray(data) && data.length > 0) {
            wpApiWorked = true;
            method = "wp-api";
            console.log(`[paesiinfesta] WP API returned ${data.length} posts from ${apiUrl}`);

            for (const post of data as WpPost[]) {
              const event = parseWpPost(post);
              if (!event) continue;
              if (seenTitles.has(event.normalizedTitle)) continue;
              seenTitles.add(event.normalizedTitle);
              allEvents.push(event);
            }
          }
        } catch (err) {
          console.log(`[paesiinfesta] WP API failed for ${apiUrl}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      console.log(`[paesiinfesta] WP API strategy failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // --- Strategy 2: HTML scraping (fallback or supplement) ---
    if (!wpApiWorked || allEvents.length < 5) {
      try {
        const htmlUrls = [
          "https://paesiinfesta.com/sagre/",
          "https://paesiinfesta.com/category/sagre/",
          "https://paesiinfesta.com/eventi/sagre/",
          "https://paesiinfesta.com/",
        ];

        for (const htmlUrl of htmlUrls) {
          if (Date.now() - startedAt > 80_000) break;
          try {
            const html = await fetchHtml(htmlUrl);
            if (html.length > 1000) {
              console.log(`[paesiinfesta] HTML fetched ${html.length} bytes from ${htmlUrl}`);
              const htmlEvents = parseHtmlListing(html);
              if (htmlEvents.length > 0) {
                method = wpApiWorked ? "wp-api+html" : "html";
                console.log(`[paesiinfesta] HTML parsed ${htmlEvents.length} events from ${htmlUrl}`);
                for (const ev of htmlEvents) {
                  if (!seenTitles.has(ev.normalizedTitle)) {
                    seenTitles.add(ev.normalizedTitle);
                    allEvents.push(ev);
                  }
                }
                break; // Found working HTML URL
              }
            }
          } catch (err) {
            console.log(`[paesiinfesta] HTML fetch failed for ${htmlUrl}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } catch {
        // HTML strategy failed completely
      }
    }

    totalFound = allEvents.length;
    console.log(`[paesiinfesta] Total unique events found: ${totalFound} (method: ${method})`);

    // Upsert all events
    for (const event of allEvents) {
      if (Date.now() - startedAt > 110_000) {
        console.log(`[paesiinfesta] Time budget exceeded, stopping`);
        break;
      }

      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[paesiinfesta] ${result}: "${event.title}" (${event.city}, ${event.province})`);
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, method=${method}`);
    console.log(`[paesiinfesta] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, method=${method}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[paesiinfesta] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-paesiinfesta] Starting -- paesiinfesta.com WordPress (WP API + HTML fallback)`);

  EdgeRuntime.waitUntil(scrapePaesiinfesta(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "paesiinfesta",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
