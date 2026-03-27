// =============================================================================
// scrape-visitcavallino — Scrape sagre from visitcavallino.com
// Tourism portal for Cavallino-Treporti (VE province).
// URL: https://www.visitcavallino.com/ita/eventi
// HTML scraping of events listing. Province always "VE", city "Cavallino-Treporti".
// No GPS coords -> status = pending_geocode.
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

  // ISO format
  const isoMatch = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

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

  // "27 marzo" (no year — assume current year)
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

  // Split on common separators
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
    console.error(`[visitcavallino] Insert error: ${error.message}`);
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
    source_name:     "visitcavallino",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- HTML parsing for visitcavallino.com ---

function parseVisitCavallinoListing(html: string): Array<{ title: string; url: string; imageUrl: string | null; dateText: string; excerpt: string }> {
  const $ = cheerio.load(html);
  const events: Array<{ title: string; url: string; imageUrl: string | null; dateText: string; excerpt: string }> = [];
  const BASE = "https://www.visitcavallino.com";

  // Try multiple selectors for event cards
  const containers = [
    ".event-item", ".evento", ".card", "article", ".item",
    "[class*='event']", "[class*='evento']", ".list-item",
    ".grid-item", ".col", ".box",
  ];

  let found = false;

  for (const selector of containers) {
    $(selector).each((_i, el) => {
      const $el = $(el);

      // Find title link
      const $link = $el.find("a").first();
      if (!$link.length) return;

      let title = decodeHtmlEntities(($link.text() || $link.attr("title") || "").trim());
      // Also try heading inside the element
      if (!title || title.length < 5) {
        title = decodeHtmlEntities(($el.find("h2, h3, h4, .title").first().text() || "").trim());
      }
      if (!title || title.length < 5) return;
      title = title.replace(/\s+/g, " ").trim();

      let href = $link.attr("href") || "";
      if (!href) return;
      if (!href.startsWith("http")) {
        href = href.startsWith("/") ? BASE + href : BASE + "/" + href;
      }

      // Skip noise/non-sagra/Asian
      if (isNoiseTitle(title)) return;
      if (isNonSagraTitle(title)) return;
      if (containsAsianFood(title)) return;

      // Image
      const $img = $el.find("img").first();
      let imageUrl = $img.attr("data-src") || $img.attr("data-lazy-src") || $img.attr("src") || null;
      if (imageUrl && !imageUrl.startsWith("http")) {
        imageUrl = imageUrl.startsWith("/") ? BASE + imageUrl : BASE + "/" + imageUrl;
      }
      if (isLowQualityUrl(imageUrl)) imageUrl = null;

      // Date text
      const dateText = $el.find("[class*='date'], [class*='data'], time, .meta, .when, .periodo").first().text().trim();

      // Excerpt
      const excerpt = $el.find("[class*='excerpt'], [class*='summary'], [class*='desc'], p").first().text().trim();

      // Deduplicate by URL
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

    if ($(selector).length > 0 && events.length > 0) {
      found = true;
      break;
    }
  }

  // Fallback: scan all links on the page for event-like URLs
  if (!found) {
    $("a[href]").each((_i, el) => {
      const href = $(el).attr("href") || "";
      if (!href.match(/\/event[oi]?\//i) && !href.match(/\/manifestazion[ei]/i)) return;

      let fullUrl = href;
      if (!fullUrl.startsWith("http")) {
        fullUrl = fullUrl.startsWith("/") ? BASE + fullUrl : BASE + "/" + fullUrl;
      }
      if (!fullUrl.includes("visitcavallino")) return;

      let title = decodeHtmlEntities(($(el).text() || $(el).attr("title") || "").trim());
      if (!title || title.length < 5) return;
      title = title.replace(/\s+/g, " ").trim();

      if (isNoiseTitle(title) || isNonSagraTitle(title) || containsAsianFood(title)) return;

      if (!events.some(e => e.url === fullUrl)) {
        events.push({
          title,
          url: fullUrl,
          imageUrl: null,
          dateText: "",
          excerpt: "",
        });
      }
    });
  }

  // Also try JSON-LD
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

        const eventUrl = ev.url ? (ev.url.startsWith("http") ? ev.url : BASE + ev.url) : BASE + "/ita/eventi";

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
    } catch { /* skip bad JSON-LD */ }
  });

  return events;
}

/** Parse detail page for description and dates */
function parseDetailPage(html: string): { description: string | null; dateText: string | null; imageUrl: string | null } {
  const $ = cheerio.load(html);
  const BASE = "https://www.visitcavallino.com";

  $("script, style, nav, header, footer, .sidebar, .comments, .related, .share, .social, .cookie, .breadcrumb").remove();

  // Description
  const contentSelectors = [
    ".entry-content", ".post-content", ".article-content", ".content",
    "[class*='event-description']", "[class*='description']",
    "article .text", "main", "#content",
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

  // Date
  const dateText = $("[class*='date'], [class*='data'], time, .meta, .when, .periodo").first().text().trim()
    || $("meta[property='event:start_time']").attr("content")
    || null;

  // Image
  let imageUrl: string | null = null;
  const $heroImg = $("[class*='featured'] img, [class*='hero'] img, article img, .entry-content img, .main-image img").first();
  if ($heroImg.length) {
    imageUrl = $heroImg.attr("data-src") || $heroImg.attr("src") || null;
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = imageUrl.startsWith("/") ? BASE + imageUrl : BASE + "/" + imageUrl;
    }
    if (isLowQualityUrl(imageUrl)) imageUrl = null;
  }

  return { description, dateText, imageUrl };
}

// --- Main scraping logic ---

const SOURCE_NAME = "visitcavallino";
const DEFAULT_CITY = "Cavallino-Treporti";
const PROVINCE = "VE";

const LISTING_URLS = [
  "https://www.visitcavallino.com/ita/eventi",
  "https://www.visitcavallino.com/ita/eventi/",
  "https://www.visitcavallino.com/it/eventi",
  "https://www.visitcavallino.com/it/eventi/",
  "https://www.visitcavallino.com/eventi/",
  "https://www.visitcavallino.com/eventi",
];

async function scrapeVisitcavallino(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  let listingUrl = "";

  try {
    // Phase 1: Get listing page
    let listingEvents: Array<{ title: string; url: string; imageUrl: string | null; dateText: string; excerpt: string }> = [];

    for (const url of LISTING_URLS) {
      if (Date.now() - startedAt > 60_000) break;

      console.log(`[visitcavallino] Trying: ${url}`);
      const html = await fetchWithTimeout(url, 15_000);
      if (!html) continue;

      const events = parseVisitCavallinoListing(html);
      if (events.length > 0) {
        listingEvents = events;
        listingUrl = url;
        console.log(`[visitcavallino] Found ${events.length} events at ${url}`);
        break;
      }

      // Check for pagination
      const $ = cheerio.load(html);
      const nextPages: string[] = [];
      $("a[href*='page'], a[href*='pagina'], .pagination a, .nav-links a").each((_i, el) => {
        const href = $(el).attr("href") || "";
        if (href && !nextPages.includes(href)) nextPages.push(href);
      });

      await new Promise(r => setTimeout(r, 1000));
    }

    // Try pagination if found events
    if (listingEvents.length > 0 && listingUrl) {
      for (let page = 2; page <= 5; page++) {
        if (Date.now() - startedAt > 80_000) break;

        const pageUrl = listingUrl.replace(/\/?$/, `/page/${page}/`);
        console.log(`[visitcavallino] Trying page ${page}: ${pageUrl}`);
        const html = await fetchWithTimeout(pageUrl, 10_000);
        if (!html) break;

        const moreEvents = parseVisitCavallinoListing(html);
        if (moreEvents.length === 0) break;

        listingEvents.push(...moreEvents);
        console.log(`[visitcavallino] Page ${page}: ${moreEvents.length} more events`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log(`[visitcavallino] Phase 1 complete: ${listingEvents.length} candidate events`);

    // Phase 2: Process each event
    for (const rawEvent of listingEvents) {
      if (Date.now() - startedAt > 110_000) {
        console.log(`[visitcavallino] Time budget exceeded, stopping`);
        break;
      }

      let { title, url, imageUrl, dateText, excerpt } = rawEvent;

      // Anti-Asian filter
      if (containsAsianFood(`${title} ${excerpt}`)) {
        console.log(`[visitcavallino] Skipping Asian food: "${title}"`);
        continue;
      }

      // Parse dates
      let [startDate, endDate] = parseDateRange(dateText);

      // Fetch detail page if needed
      let description: string | null = excerpt || null;
      if ((!startDate || !description || description.length < 30) && url) {
        console.log(`[visitcavallino] Fetching detail: ${url}`);
        const detailHtml = await fetchWithTimeout(url, 10_000);
        if (detailHtml) {
          const detail = parseDetailPage(detailHtml);
          if (!startDate && detail.dateText) {
            [startDate, endDate] = parseDateRange(detail.dateText);
          }
          if (detail.description) {
            description = detail.description;
            if (containsAsianFood(description)) {
              console.log(`[visitcavallino] Skipping Asian food in detail: "${title}"`);
              continue;
            }
          }
          if (!imageUrl && detail.imageUrl) imageUrl = detail.imageUrl;
        }
        await new Promise(r => setTimeout(r, 1500));
      }

      // Skip without date
      if (!startDate) {
        console.log(`[visitcavallino] Skipping "${title}" -- no date`);
        continue;
      }

      // Past year filter
      if (containsPastYear(title, url, description || "")) {
        console.log(`[visitcavallino] Skipping past year: "${title}"`);
        continue;
      }

      // Skip past events
      const eventEnd = endDate || startDate;
      if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
        console.log(`[visitcavallino] Skipping past event: "${title}" (ends ${eventEnd})`);
        continue;
      }

      if (description && description.length > 2000) {
        description = description.slice(0, 2000);
      }

      const event: NormalizedEvent = {
        title: title.slice(0, 200),
        normalizedTitle: normalizeText(title),
        slug: generateSlug(title, DEFAULT_CITY),
        city: DEFAULT_CITY,
        province: PROVINCE,
        startDate,
        endDate: endDate || startDate,
        priceInfo: null,
        isFree: null,
        imageUrl,
        url,
        sourceDescription: description,
        contentHash: generateContentHash(title, DEFAULT_CITY, startDate),
      };

      totalFound++;
      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[visitcavallino] ${result}: "${event.title}" (${event.city}, ${event.province})`);
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, listing_url=${listingUrl}`);
    console.log(`[visitcavallino] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[visitcavallino] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-visitcavallino] Starting -- visitcavallino.com (Cavallino-Treporti, VE)`);

  EdgeRuntime.waitUntil(scrapeVisitcavallino(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "visitcavallino",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
