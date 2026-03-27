// =============================================================================
// scrape-eventideltapo — Scrape sagre from eventideltapo.it
// HTML scraping of events listing pages for the Delta del Po area (RO).
// Covers: Adria, Ariano nel Polesine, Porto Tolle, Porto Viro, Rosolina, Taglio di Po.
// Province always "RO". No GPS coords -> status = pending_geocode.
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

// --- Delta del Po cities ---

const DELTA_PO_CITIES = [
  "Adria", "Ariano nel Polesine", "Porto Tolle", "Porto Viro",
  "Rosolina", "Taglio di Po", "Corbola", "Papozze", "Loreo",
  "Donada", "Contarina", "Ca' Tiepolo", "Pila", "Boccasette",
  "Scardovari", "Polesella", "Costa di Rovigo", "Villadose",
];

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

  // ISO format: 2026-03-27
  const isoMatch = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  // "27 marzo 2026" or "27 mar 2026"
  const italianMatch = t.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\w*\s+(\d{4})/i);
  if (italianMatch) {
    const day = parseInt(italianMatch[1], 10);
    const month = ITALIAN_MONTHS[italianMatch[2].toLowerCase()];
    const year = parseInt(italianMatch[3], 10);
    if (month && day >= 1 && day <= 31 && year >= 2024 && year <= 2030) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // "27/03/2026" or "27-03-2026"
  const ddmmyyyy = t.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10);
    const year = parseInt(ddmmyyyy[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2024 && year <= 2030) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

/** Parse a date range string and return [startDate, endDate] */
function parseDateRange(text: string): [string | null, string | null] {
  if (!text) return [null, null];
  const t = text.trim();

  // Try splitting on common separators: " - ", " al ", " fino al "
  const parts = t.split(/\s*(?:-|–|—|al|fino\s+al)\s*/i);
  if (parts.length >= 2) {
    const start = parseItalianDate(parts[0]);
    const end = parseItalianDate(parts[parts.length - 1]);
    if (start && end) return [start, end];
    // If end has no year, try to infer from start
    if (start && !end) {
      // "27 marzo - 2 aprile 2026" → end part might be "2 aprile 2026"
      const endWithYear = parseItalianDate(parts[parts.length - 1] + " " + start.slice(0, 4));
      if (endWithYear) return [start, endWithYear];
    }
  }

  // Single date
  const single = parseItalianDate(t);
  return [single, single];
}

// --- Extract city from title or text ---

function extractCityFromText(text: string): string | null {
  const t = text.trim();
  // Check if any known Delta del Po city is mentioned
  for (const city of DELTA_PO_CITIES) {
    if (t.toLowerCase().includes(city.toLowerCase())) return city;
  }
  // Pattern: "... a CityName"
  const patternA = t.match(
    /\ba\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:di|del|della|delle|dei|nel|d['']\s*)\s+[A-ZÀ-Ú][a-zà-ú]+)*(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/i
  );
  if (patternA) return patternA[1].trim();
  // Pattern: "... – CityName"
  const patternDash = t.match(
    /\s*[–—-]\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:di|del|della|nel)\s+[A-ZÀ-Ú][a-zà-ú]+)*(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/
  );
  if (patternDash) return patternDash[1].trim();
  return null;
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
      insertData.slug = event.slug + "-" + Date.now().toString(36);
      insertData.content_hash = event.contentHash + Date.now().toString(36);
      const { data: retryData } = await supabase.from("sagre")
        .insert(insertData)
        .select("id")
        .single();
      return { result: "inserted", id: retryData?.id };
    }
    console.error(`[eventideltapo] Insert error: ${error.message}`);
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
    source_name:     "eventideltapo",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- HTML parsing ---

/** Parse event listing page (typical Italian event portal HTML structure) */
function parseEventListing(html: string, baseUrl: string): Array<{ title: string; url: string; imageUrl: string | null; dateText: string; city: string | null; excerpt: string }> {
  const $ = cheerio.load(html);
  const events: Array<{ title: string; url: string; imageUrl: string | null; dateText: string; city: string | null; excerpt: string }> = [];

  // Try common event listing selectors
  const selectors = [
    "article", ".event-item", ".evento", ".event", ".card",
    ".post", ".entry", ".item", "[class*='event']", "[class*='evento']",
    ".list-item", ".listing-item", "li.type-event",
  ];

  for (const selector of selectors) {
    $(selector).each((_i, el) => {
      const $el = $(el);

      // Title + link
      const $link = $el.find("a[href*='event'], a[href*='evento'], h2 a, h3 a, .title a, a.title").first();
      if (!$link.length) return;

      let title = decodeHtmlEntities(($link.text() || $link.attr("title") || "").trim());
      if (!title) return;
      title = title.replace(/\s+/g, " ").trim();

      let href = $link.attr("href") || "";
      if (href && !href.startsWith("http")) {
        href = new URL(href, baseUrl).toString();
      }
      if (!href) return;

      // Skip noise/non-sagra
      if (isNoiseTitle(title)) return;
      if (isNonSagraTitle(title)) return;
      if (containsAsianFood(title)) return;

      // Image
      const $img = $el.find("img").first();
      let imageUrl = $img.attr("data-src") || $img.attr("src") || null;
      if (imageUrl && !imageUrl.startsWith("http")) {
        imageUrl = new URL(imageUrl, baseUrl).toString();
      }
      if (isLowQualityUrl(imageUrl)) imageUrl = null;

      // Date text
      const dateText = $el.find("[class*='date'], [class*='data'], time, .meta").first().text().trim();

      // Excerpt
      const excerpt = $el.find("[class*='excerpt'], [class*='summary'], .description, p").first().text().trim();

      // City
      const cityFromTitle = extractCityFromText(title);
      const cityFromExcerpt = !cityFromTitle ? extractCityFromText(excerpt) : null;

      events.push({
        title,
        url: href,
        imageUrl,
        dateText,
        city: cityFromTitle || cityFromExcerpt,
        excerpt: excerpt.slice(0, 500),
      });
    });

    if (events.length > 0) break; // Found events with this selector, stop trying others
  }

  return events;
}

/** Parse a detail page for additional info (description, dates, location) */
function parseDetailPage(html: string, baseUrl: string): { description: string | null; dateText: string | null; city: string | null; imageUrl: string | null } {
  const $ = cheerio.load(html);

  // Remove noise
  $("script, style, nav, header, footer, .sidebar, .comments, .related, .share, .social, .cookie").remove();

  // Description from main content
  const contentSelectors = [
    ".entry-content", ".post-content", ".article-content", ".content",
    "[class*='event-description']", "[class*='evento-content']",
    "article .text", "main .text", "#content",
  ];

  let description: string | null = null;
  for (const sel of contentSelectors) {
    const $content = $(sel).first();
    if ($content.length) {
      let text = stripHtmlTags(decodeHtmlEntities($content.html() || ""));
      text = text.replace(/\s+/g, " ").trim();
      if (text.length > 20) {
        description = text.length > 2000 ? text.slice(0, 2000) : text;
        break;
      }
    }
  }

  // Date
  const dateText = $("[class*='date'], [class*='data'], time, [itemprop='startDate']").first().text().trim()
    || $("meta[property='event:start_time']").attr("content")
    || null;

  // City from content
  const allText = $("body").text();
  const city = extractCityFromText(allText.slice(0, 2000));

  // Better image
  let imageUrl: string | null = null;
  const $heroImg = $("[class*='featured'] img, [class*='hero'] img, article img, .entry-content img").first();
  if ($heroImg.length) {
    imageUrl = $heroImg.attr("data-src") || $heroImg.attr("src") || null;
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = new URL(imageUrl, baseUrl).toString();
    }
    if (isLowQualityUrl(imageUrl)) imageUrl = null;
  }

  return { description, dateText, city, imageUrl };
}

// --- Main scraping logic ---

const SOURCE_NAME = "eventideltapo";
const BASE_URL = "https://www.eventideltapo.it";

// Multiple URL patterns to try — the site structure may vary
const LISTING_URLS = [
  `${BASE_URL}/eventi/`,
  `${BASE_URL}/eventi/sagre/`,
  `${BASE_URL}/sagre/`,
  `${BASE_URL}/events/`,
  `${BASE_URL}/category/sagre/`,
  `${BASE_URL}/categoria/sagre-e-feste/`,
  `${BASE_URL}/`,
];

async function scrapeEventideltapo(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  let listingUrl = "";

  try {
    // Phase 1: Find the events listing page
    let listingEvents: Array<{ title: string; url: string; imageUrl: string | null; dateText: string; city: string | null; excerpt: string }> = [];

    for (const url of LISTING_URLS) {
      if (Date.now() - startedAt > 100_000) break;

      console.log(`[eventideltapo] Trying listing URL: ${url}`);
      const html = await fetchWithTimeout(url, 15_000);
      if (!html) continue;

      const events = parseEventListing(html, url);
      if (events.length > 0) {
        listingEvents = events;
        listingUrl = url;
        console.log(`[eventideltapo] Found ${events.length} events at ${url}`);
        break;
      }

      // Also try JSON-LD on the page
      const $ = cheerio.load(html);
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

            let city = ev.location?.address?.addressLocality || ev.location?.name || null;
            if (city) city = decodeHtmlEntities(String(city).trim());

            let startDate = ev.startDate ? String(ev.startDate).slice(0, 10) : null;
            const dateText = startDate || "";

            let imgUrl: string | null = null;
            if (ev.image) {
              imgUrl = typeof ev.image === "string" ? ev.image : (ev.image.url || ev.image[0] || null);
            }

            listingEvents.push({
              title,
              url: ev.url || url,
              imageUrl: isLowQualityUrl(imgUrl) ? null : imgUrl,
              dateText,
              city: city || extractCityFromText(title),
              excerpt: ev.description ? String(ev.description).slice(0, 500) : "",
            });
          }
        } catch { /* skip bad JSON-LD */ }
      });

      if (listingEvents.length > 0) {
        listingUrl = url;
        console.log(`[eventideltapo] Found ${listingEvents.length} events via JSON-LD at ${url}`);
        break;
      }

      // Also scan for links to individual event pages
      const links: string[] = [];
      $("a[href]").each((_i, el) => {
        const href = $(el).attr("href") || "";
        if (href.match(/\/event[oi]?\//i) && !href.match(/\/category\//i)) {
          const fullUrl = href.startsWith("http") ? href : new URL(href, url).toString();
          if (fullUrl.includes("eventideltapo") && !links.includes(fullUrl)) {
            links.push(fullUrl);
          }
        }
      });

      if (links.length > 0) {
        console.log(`[eventideltapo] Found ${links.length} event links at ${url}`);
        listingUrl = url;
        // Create basic entries from links — will be detailed in phase 2
        for (const link of links.slice(0, 30)) {
          // Extract title from URL slug
          const slug = link.split("/").filter(Boolean).pop() || "";
          const title = decodeHtmlEntities(slug.replace(/-/g, " ").replace(/\d{4}/g, "").trim());
          if (title.length >= 5 && !isNoiseTitle(title) && !isNonSagraTitle(title) && !containsAsianFood(title)) {
            listingEvents.push({
              title: title.charAt(0).toUpperCase() + title.slice(1),
              url: link,
              imageUrl: null,
              dateText: "",
              city: extractCityFromText(title),
              excerpt: "",
            });
          }
        }
        break;
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`[eventideltapo] Phase 1 complete: ${listingEvents.length} candidate events from ${listingUrl}`);

    // Phase 2: Process each event (optionally fetch detail pages)
    for (const rawEvent of listingEvents) {
      if (Date.now() - startedAt > 110_000) {
        console.log(`[eventideltapo] Time budget exceeded, stopping`);
        break;
      }

      let { title, url, imageUrl, dateText, city, excerpt } = rawEvent;

      // Anti-Asian filter on all text
      if (containsAsianFood(`${title} ${excerpt}`)) {
        console.log(`[eventideltapo] Skipping Asian food: "${title}"`);
        continue;
      }

      // Parse dates
      let [startDate, endDate] = parseDateRange(dateText);

      // If no date from listing, try detail page
      let description: string | null = excerpt || null;
      if (!startDate && url) {
        console.log(`[eventideltapo] Fetching detail: ${url}`);
        const detailHtml = await fetchWithTimeout(url, 10_000);
        if (detailHtml) {
          const detail = parseDetailPage(detailHtml, url);
          if (detail.dateText) {
            [startDate, endDate] = parseDateRange(detail.dateText);
          }
          if (detail.description) {
            description = detail.description;
            // Re-check Asian filter on detail description
            if (containsAsianFood(description)) {
              console.log(`[eventideltapo] Skipping Asian food in detail: "${title}"`);
              continue;
            }
          }
          if (!city && detail.city) city = detail.city;
          if (!imageUrl && detail.imageUrl) imageUrl = detail.imageUrl;
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      // Default city for Delta del Po area if none found
      if (!city) city = "Delta del Po";

      // Skip events without start date
      if (!startDate) {
        console.log(`[eventideltapo] Skipping "${title}" -- no date`);
        continue;
      }

      // Past year filter
      if (containsPastYear(title, url, description || "")) {
        console.log(`[eventideltapo] Skipping past year: "${title}"`);
        continue;
      }

      // Skip past events
      const eventEnd = endDate || startDate;
      if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
        console.log(`[eventideltapo] Skipping past event: "${title}" (ends ${eventEnd})`);
        continue;
      }

      // Truncate description
      if (description && description.length > 2000) {
        description = description.slice(0, 2000);
      }

      const event: NormalizedEvent = {
        title: title.slice(0, 200),
        normalizedTitle: normalizeText(title),
        slug: generateSlug(title, city),
        city,
        province: "RO",
        startDate,
        endDate: endDate || startDate,
        priceInfo: null,
        isFree: null,
        imageUrl,
        url,
        sourceDescription: description,
        contentHash: generateContentHash(title, city, startDate),
      };

      totalFound++;
      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[eventideltapo] ${result}: "${event.title}" (${event.city}, ${event.province})`);
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, listing_url=${listingUrl}`);
    console.log(`[eventideltapo] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[eventideltapo] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-eventideltapo] Starting -- eventideltapo.it (Delta del Po, RO)`);

  EdgeRuntime.waitUntil(scrapeEventideltapo(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "eventideltapo",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
