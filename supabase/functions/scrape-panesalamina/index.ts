// =============================================================================
// scrape-panesalamina — Scrape sagre from panesalamina.com (WordPress REST API)
// WordPress site covering Verona south/west area (Valeggio sul Mincio,
// Villafranca, Isola della Scala, Bussolengo, etc.).
// Uses WP REST API at /wp-json/wp/v2/posts to fetch event posts.
// Province always "VR". No GPS coords → status starts at pending_geocode.
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

interface WPPost {
  id: number;
  date: string;
  modified: string;
  slug: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  link: string;
  categories: number[];
  tags: number[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url?: string;
      media_details?: {
        sizes?: {
          large?: { source_url: string };
          medium_large?: { source_url: string };
          full?: { source_url: string };
        };
      };
    }>;
    "wp:term"?: Array<Array<{ id: number; name: string; slug: string }>>;
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

function stripHtml(html: string): string {
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

function isLowQualityUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  for (const pattern of BAD_IMAGE_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  return false;
}

// --- Known Verona-province cities in the panesalamina coverage area ---
// Used to extract city from post title/content
const VERONA_CITIES: string[] = [
  "Valeggio sul Mincio", "Villafranca di Verona", "Isola della Scala",
  "Bussolengo", "Peschiera del Garda", "Lazise", "Bardolino", "Garda",
  "Castelnuovo del Garda", "Sona", "Sommacampagna", "Vigasio", "Bovolone",
  "Cerea", "Legnago", "Zevio", "San Bonifacio", "Soave", "Colognola ai Colli",
  "Caldiero", "San Giovanni Lupatoto", "Grezzana", "Negrar", "San Pietro in Cariano",
  "Fumane", "Dolcè", "Caprino Veronese", "Malcesine", "Torri del Benaco",
  "Affi", "Cavaion Veronese", "Costermano", "Rivoli Veronese", "Pastrengo",
  "Pescantina", "San Martino Buon Albergo", "Lavagno", "Mezzane di Sotto",
  "Illasi", "Tregnago", "Monteforte d'Alpone", "Montecchia di Crosara",
  "Roverè Veronese", "Velo Veronese", "Bosco Chiesanuova", "Erbezzo",
  "Sant'Anna d'Alfaedo", "Cerro Veronese", "Buttapietra", "Castel d'Azzano",
  "Villafranca", "Verona", "Oppeano", "Palù", "Ronco all'Adige",
  "Albaredo d'Adige", "Veronella", "Minerbe", "Bevilacqua", "Boschi Sant'Anna",
  "Angiari", "Terrazzo", "Villa Bartolomea", "Castagnaro", "Roverchiara",
  "Nogara", "Gazzo Veronese", "Sanguinetto", "Casaleone", "Concamarise",
  "Salizzole", "Erbè", "Sorgà", "Trevenzuolo", "Nogarole Rocca",
  "Mozzecane", "Povegliano Veronese", "Valeggio", "Volta Mantovana",
  "Brentino Belluno", "Dolcé", "Torri", "Malcesine",
];

// Sort by length descending so longer names match first (e.g., "Villafranca di Verona" before "Villafranca")
const CITIES_SORTED = [...VERONA_CITIES].sort((a, b) => b.length - a.length);

function extractCityFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const city of CITIES_SORTED) {
    if (lower.includes(city.toLowerCase())) return city;
  }
  return null;
}

// --- Date extraction from WP post content ---

const MONTH_MAP: Record<string, string> = {
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04",
  maggio: "05", giugno: "06", luglio: "07", agosto: "08",
  settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
};

function extractDatesFromText(text: string): { startDate: string | null; endDate: string | null } {
  const currentYear = new Date().getFullYear();

  // Pattern: "dal 5 al 7 giugno 2026" or "dal 5 al 7 giugno"
  const rangeMatch = text.match(
    /dal\s+(\d{1,2})\s+al\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})?/i
  );
  if (rangeMatch) {
    const [, startDay, endDay, month, yearStr] = rangeMatch;
    const mm = MONTH_MAP[month.toLowerCase()];
    const yyyy = yearStr || String(currentYear);
    return {
      startDate: `${yyyy}-${mm}-${startDay.padStart(2, "0")}`,
      endDate: `${yyyy}-${mm}-${endDay.padStart(2, "0")}`,
    };
  }

  // Pattern: "5-7 giugno 2026" or "5-7 giugno"
  const dashRange = text.match(
    /(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})?/i
  );
  if (dashRange) {
    const [, startDay, endDay, month, yearStr] = dashRange;
    const mm = MONTH_MAP[month.toLowerCase()];
    const yyyy = yearStr || String(currentYear);
    return {
      startDate: `${yyyy}-${mm}-${startDay.padStart(2, "0")}`,
      endDate: `${yyyy}-${mm}-${endDay.padStart(2, "0")}`,
    };
  }

  // Pattern: "5 giugno 2026" or "5 giugno" (single date)
  const singleMatch = text.match(
    /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})?/i
  );
  if (singleMatch) {
    const [, day, month, yearStr] = singleMatch;
    const mm = MONTH_MAP[month.toLowerCase()];
    const yyyy = yearStr || String(currentYear);
    const d = `${yyyy}-${mm}-${day.padStart(2, "0")}`;
    return { startDate: d, endDate: d };
  }

  // Pattern: "dd/mm/yyyy" or "dd-mm-yyyy"
  const numericMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (numericMatch) {
    const [, dd, mm, yyyy] = numericMatch;
    const d = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    return { startDate: d, endDate: d };
  }

  return { startDate: null, endDate: null };
}

// --- HTTP fetch helper ---

async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T | null> {
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
    return (await resp.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

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
    status:             "pending_geocode",  // No GPS coords from WP API
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
    console.error(`[panesalamina] Insert error: ${error.message}`);
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
    source_name:     "panesalamina",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- WP post parser ---

function parseWPPost(post: WPPost): NormalizedEvent | null {
  // Decode title
  const rawTitle = decodeHtmlEntities(post.title.rendered).trim();
  if (!rawTitle) return null;

  // Apply filters
  if (isNoiseTitle(rawTitle)) {
    console.log(`[panesalamina] Skipping noise title: "${rawTitle}"`);
    return null;
  }
  if (isNonSagraTitle(rawTitle)) {
    console.log(`[panesalamina] Skipping non-sagra title: "${rawTitle}"`);
    return null;
  }

  // Extract plain text from HTML content
  const contentHtml = post.content.rendered;
  const plainText = stripHtml(decodeHtmlEntities(contentHtml));

  // Apply past year filter
  if (containsPastYear(rawTitle, post.link, plainText)) {
    console.log(`[panesalamina] Skipping past year: "${rawTitle}"`);
    return null;
  }

  // Extract dates from title + content
  const titleAndContent = `${rawTitle} ${plainText}`;
  const { startDate, endDate } = extractDatesFromText(titleAndContent);

  // Skip events without date
  if (!startDate) {
    console.log(`[panesalamina] Skipping "${rawTitle}" — no date found`);
    return null;
  }

  // Skip past events
  const eventEnd = endDate || startDate;
  if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
    console.log(`[panesalamina] Skipping past event: "${rawTitle}" (ends ${eventEnd})`);
    return null;
  }

  // Extract city from title or content
  let city = extractCityFromText(rawTitle) || extractCityFromText(plainText);

  // If no city found in text, try WP categories/tags
  if (!city && post._embedded?.["wp:term"]) {
    for (const termGroup of post._embedded["wp:term"]) {
      for (const term of termGroup) {
        const foundCity = extractCityFromText(term.name);
        if (foundCity) {
          city = foundCity;
          break;
        }
      }
      if (city) break;
    }
  }

  // Default city to "Verona" if nothing found — better than empty
  if (!city) {
    console.log(`[panesalamina] No city found for "${rawTitle}", defaulting to Verona`);
    city = "Verona";
  }

  // Extract description — truncate to 2000 chars
  let description = plainText;
  if (description.length > 2000) description = description.slice(0, 2000);
  if (description.length < 10) description = null;

  // Extract image — prefer featured media, fallback to og:image or content image
  let imageUrl: string | null = null;
  if (post._embedded?.["wp:featuredmedia"]?.[0]) {
    const media = post._embedded["wp:featuredmedia"][0];
    const sizes = media.media_details?.sizes;
    imageUrl = sizes?.large?.source_url
      || sizes?.medium_large?.source_url
      || sizes?.full?.source_url
      || media.source_url
      || null;
  }
  if (!imageUrl || isLowQualityUrl(imageUrl)) {
    // Try first image in content
    const $ = cheerio.load(contentHtml);
    const contentImg = $("img").first().attr("src");
    if (contentImg && !isLowQualityUrl(contentImg)) {
      imageUrl = contentImg.startsWith("http") ? contentImg : `https://panesalamina.com${contentImg}`;
    }
  }
  if (isLowQualityUrl(imageUrl)) imageUrl = null;

  // Price info — check content for free/paid keywords
  let priceInfo: string | null = null;
  let isFree: boolean | null = null;
  const lowerContent = plainText.toLowerCase();
  if (/\b(ingresso\s+gratuito|entrata\s+gratuita|entrata\s+libera|ingresso\s+libero|gratis)\b/i.test(lowerContent)) {
    isFree = true;
    priceInfo = "Ingresso gratuito";
  }

  const title = rawTitle.slice(0, 200);

  return {
    title,
    normalizedTitle: normalizeText(title),
    slug: generateSlug(title, city),
    city,
    province: "VR",
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

// --- Fallback: HTML scraper for events listing page ---

async function scrapeHtmlFallback(supabase: SupabaseClient, startedAt: number): Promise<{
  found: number; inserted: number; merged: number; skipped: number;
}> {
  let found = 0, inserted = 0, merged = 0, skipped = 0;

  // Try multiple possible event listing URLs
  const listingUrls = [
    "https://panesalamina.com/eventi/location/verona",
    "https://panesalamina.com/category/sagre-e-feste/",
    "https://panesalamina.com/eventi/",
    "https://panesalamina.com/sagre/",
  ];

  for (const listingUrl of listingUrls) {
    console.log(`[panesalamina] Trying HTML listing: ${listingUrl}`);
    const html = await fetchWithTimeout(listingUrl, 15_000);
    if (!html) continue;

    const $ = cheerio.load(html);

    // Find all event/post links
    const links: string[] = [];
    $("a[href]").each((_i: number, el: cheerio.Element) => {
      const href = $(el).attr("href");
      if (!href) return;
      // Match panesalamina.com post URLs (typically /YYYY/MM/DD/slug/ or /slug/)
      if (
        href.startsWith("https://panesalamina.com/") &&
        !href.includes("/category/") &&
        !href.includes("/tag/") &&
        !href.includes("/author/") &&
        !href.includes("/page/") &&
        !href.includes("/wp-") &&
        !href.includes("/feed") &&
        !href.includes("#") &&
        href !== "https://panesalamina.com/" &&
        href !== listingUrl
      ) {
        // Likely a post link — check for sagra/festa keywords or date patterns in URL
        const path = href.replace("https://panesalamina.com/", "");
        if (path.split("/").length >= 2 && !links.includes(href)) {
          links.push(href);
        }
      }
    });

    console.log(`[panesalamina] Found ${links.length} links on ${listingUrl}`);
    if (links.length === 0) continue;

    // Fetch each detail page
    for (const detailUrl of links.slice(0, 50)) {
      if (Date.now() - startedAt > 110_000) {
        console.log(`[panesalamina] Time budget exceeded`);
        break;
      }

      const detailHtml = await fetchWithTimeout(detailUrl, 10_000);
      if (!detailHtml) continue;

      const d$ = cheerio.load(detailHtml);

      // Extract title
      const rawTitle = decodeHtmlEntities(
        d$("h1.entry-title, h1.post-title, article h1, .entry-header h1").first().text().trim()
        || d$("title").text().split("|")[0].split("-")[0].trim()
      );
      if (!rawTitle || isNoiseTitle(rawTitle) || isNonSagraTitle(rawTitle)) continue;

      // Extract content
      const contentEl = d$(".entry-content, .post-content, article .content, .the-content");
      const plainText = stripHtml(decodeHtmlEntities(contentEl.html() || ""));

      if (containsPastYear(rawTitle, detailUrl, plainText)) continue;

      const { startDate, endDate } = extractDatesFromText(`${rawTitle} ${plainText}`);
      if (!startDate) continue;

      const eventEnd = endDate || startDate;
      if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) continue;

      let city = extractCityFromText(rawTitle) || extractCityFromText(plainText) || "Verona";

      let imageUrl: string | null = null;
      const ogImg = d$('meta[property="og:image"]').attr("content");
      if (ogImg && !isLowQualityUrl(ogImg)) imageUrl = ogImg;
      if (!imageUrl) {
        const firstImg = contentEl.find("img").first().attr("src");
        if (firstImg && !isLowQualityUrl(firstImg)) {
          imageUrl = firstImg.startsWith("http") ? firstImg : `https://panesalamina.com${firstImg}`;
        }
      }

      let description = plainText;
      if (description.length > 2000) description = description.slice(0, 2000);

      const title = rawTitle.slice(0, 200);
      const event: NormalizedEvent = {
        title,
        normalizedTitle: normalizeText(title),
        slug: generateSlug(title, city),
        city,
        province: "VR",
        startDate,
        endDate: endDate || startDate,
        priceInfo: /\b(ingresso\s+gratuito|entrata\s+libera|gratis)\b/i.test(plainText.toLowerCase()) ? "Ingresso gratuito" : null,
        isFree: /\b(ingresso\s+gratuito|entrata\s+libera|gratis)\b/i.test(plainText.toLowerCase()) ? true : null,
        imageUrl,
        url: detailUrl,
        sourceDescription: description.length >= 10 ? description : null,
        contentHash: generateContentHash(title, city, startDate),
      };

      found++;
      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") inserted++;
      else if (result === "merged") merged++;
      else skipped++;

      console.log(`[panesalamina] ${result}: "${event.title}" (${event.city})`);

      // Politeness delay
      await new Promise(r => setTimeout(r, 1500));
    }

    // If we got results from one listing URL, don't try the others
    if (found > 0) break;
  }

  return { found, inserted, merged, skipped };
}

// --- Main scraping logic ---

const WP_API_BASE = "https://panesalamina.com/wp-json/wp/v2/posts";
const SOURCE_NAME = "panesalamina";
const MAX_PAGES = 5;
const PER_PAGE = 50;
const DELAY_MS = 1500;

// Sagra-related search terms to query WP REST API
const SEARCH_TERMS = ["sagra", "festa", "gastronomica", "enogastronomica", "polenta", "gnocchi"];

async function scrapePanesalamina(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  let usedWpApi = false;

  try {
    // Phase 1: Try WP REST API
    console.log(`[panesalamina] Trying WordPress REST API...`);

    const seenPostIds = new Set<number>();
    const allEvents: NormalizedEvent[] = [];

    for (const searchTerm of SEARCH_TERMS) {
      if (Date.now() - startedAt > 80_000) break;

      for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `${WP_API_BASE}?search=${encodeURIComponent(searchTerm)}&per_page=${PER_PAGE}&page=${page}&_embed&orderby=date&order=desc`;
        console.log(`[panesalamina] WP API: search="${searchTerm}" page=${page}`);

        const posts = await fetchJson<WPPost[]>(url, 15_000);

        if (!posts || posts.length === 0) {
          if (page === 1 && searchTerm === SEARCH_TERMS[0]) {
            console.log(`[panesalamina] WP REST API not available or empty — will try HTML fallback`);
          }
          break;
        }

        usedWpApi = true;

        for (const post of posts) {
          if (seenPostIds.has(post.id)) continue;
          seenPostIds.add(post.id);

          const event = parseWPPost(post);
          if (event) allEvents.push(event);
        }

        // If fewer than per_page results, no more pages
        if (posts.length < PER_PAGE) break;

        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }

    // Also fetch recent posts without search filter (catches unlabeled events)
    if (usedWpApi) {
      for (let page = 1; page <= 3; page++) {
        if (Date.now() - startedAt > 90_000) break;

        const url = `${WP_API_BASE}?per_page=${PER_PAGE}&page=${page}&_embed&orderby=date&order=desc`;
        console.log(`[panesalamina] WP API: recent posts page=${page}`);

        const posts = await fetchJson<WPPost[]>(url, 15_000);
        if (!posts || posts.length === 0) break;

        for (const post of posts) {
          if (seenPostIds.has(post.id)) continue;
          seenPostIds.add(post.id);

          const event = parseWPPost(post);
          if (event) allEvents.push(event);
        }

        if (posts.length < PER_PAGE) break;
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }

    if (usedWpApi && allEvents.length > 0) {
      console.log(`[panesalamina] WP API: parsed ${allEvents.length} events from ${seenPostIds.size} posts`);

      // Phase 2: Upsert all parsed events
      for (const event of allEvents) {
        totalFound++;
        const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
        if (result === "inserted") totalInserted++;
        else if (result === "merged") totalMerged++;
        else totalSkipped++;

        console.log(`[panesalamina] ${result}: "${event.title}" (${event.city})`);
      }
    } else {
      // Phase 1b: Fallback to HTML scraping
      console.log(`[panesalamina] WP API yielded no results — falling back to HTML scraping`);
      const fbResult = await scrapeHtmlFallback(supabase, startedAt);
      totalFound = fbResult.found;
      totalInserted = fbResult.inserted;
      totalMerged = fbResult.merged;
      totalSkipped = fbResult.skipped;
    }

    const method = usedWpApi ? "wp-api" : "html-fallback";
    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, method=${method}, posts_checked=${usedWpApi ? seenPostIds.size : "n/a"}`);
    console.log(`[panesalamina] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, method=${method}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[panesalamina] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-panesalamina] Starting — scraping panesalamina.com Verona area events`);

  EdgeRuntime.waitUntil(scrapePanesalamina(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "panesalamina",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
