// =============================================================================
// scrape-2d2web — Scrape sagre from 2d2web.com (multi-province Veneto aggregator)
// Loops through all 7 Veneto province URLs, paginated with ?pg=N.
// HTML is static ASP.NET, parsed with Cheerio.
// No GPS coords → status starts at pending_geocode.
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

// Anti-Asian food filter — RULE: must be applied to ALL image URLs
const BANNED_IMAGE_RE = /sushi|chopstick|asian|chinese|japanese|ramen|wok|noodle|dim.?sum|tofu|soy.?sauce|kimchi|thai|vietnamese|korean|oriental|bento|miso|teriyaki|tempura|gyoza|edamame|wasabi|sashimi|udon|pho|curry|pad.?thai|spring.?roll|dumpling/i;

function isLowQualityUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  for (const pattern of BAD_IMAGE_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  // Anti-Asian food filter on image URLs
  if (BANNED_IMAGE_RE.test(url)) return true;
  return false;
}

// --- Province mapping ---

const PROVINCE_SLUG_TO_CODE: Record<string, string> = {
  belluno: "BL",
  padova: "PD",
  rovigo: "RO",
  treviso: "TV",
  venezia: "VE",
  vicenza: "VI",
  verona: "VR",
};

// All 7 Veneto province URL slugs
const VENETO_PROVINCES = ["belluno", "padova", "rovigo", "treviso", "venezia", "vicenza", "verona"];

// --- Italian month names to numbers ---

const ITALIAN_MONTHS: Record<string, string> = {
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04",
  maggio: "05", giugno: "06", luglio: "07", agosto: "08",
  settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
  gen: "01", feb: "02", mar: "03", apr: "04",
  mag: "05", giu: "06", lug: "07", ago: "08",
  set: "09", ott: "10", nov: "11", dic: "12",
};

/**
 * Parse Italian date strings commonly found on 2d2web.com.
 * Formats:
 *   "dal 5 al 12 aprile 2026"
 *   "dal 28 marzo al 5 aprile 2026"
 *   "5 aprile 2026"
 *   "dal 5 aprile 2026 al 12 aprile 2026"
 *   "5 - 12 aprile 2026"
 *   "05/04/2026"
 *   "dal 05/04/2026 al 12/04/2026"
 */
function parseItalianDates(text: string): { start: string | null; end: string | null } {
  if (!text) return { start: null, end: null };

  const t = text.trim().toLowerCase();

  // Try DD/MM/YYYY format: "dal 05/04/2026 al 12/04/2026" or single "05/04/2026"
  const slashRangeMatch = t.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(?:[-–]|al?)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/
  );
  if (slashRangeMatch) {
    const [, d1, m1, y1, d2, m2, y2] = slashRangeMatch;
    return {
      start: `${y1}-${m1.padStart(2, "0")}-${d1.padStart(2, "0")}`,
      end: `${y2}-${m2.padStart(2, "0")}-${d2.padStart(2, "0")}`,
    };
  }

  const slashSingleMatch = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashSingleMatch) {
    const [, d, m, y] = slashSingleMatch;
    const date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return { start: date, end: date };
  }

  // Build month pattern for regex
  const monthNames = Object.keys(ITALIAN_MONTHS).join("|");

  // "dal 28 marzo al 5 aprile 2026" (cross-month range)
  const crossMonthMatch = t.match(
    new RegExp(`(?:dal?\\s+)?(\\d{1,2})\\s+(${monthNames})\\s+(?:al?|[-–])\\s+(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})`)
  );
  if (crossMonthMatch) {
    const [, d1, m1, d2, m2, year] = crossMonthMatch;
    return {
      start: `${year}-${ITALIAN_MONTHS[m1]}-${d1.padStart(2, "0")}`,
      end: `${year}-${ITALIAN_MONTHS[m2]}-${d2.padStart(2, "0")}`,
    };
  }

  // "dal 5 al 12 aprile 2026" or "5 - 12 aprile 2026" (same-month range)
  const sameMonthMatch = t.match(
    new RegExp(`(?:dal?\\s+)?(\\d{1,2})\\s*(?:al?|[-–])\\s*(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})`)
  );
  if (sameMonthMatch) {
    const [, d1, d2, month, year] = sameMonthMatch;
    const m = ITALIAN_MONTHS[month];
    return {
      start: `${year}-${m}-${d1.padStart(2, "0")}`,
      end: `${year}-${m}-${d2.padStart(2, "0")}`,
    };
  }

  // "dal 5 aprile 2026 al 12 aprile 2026" (full dates on both sides)
  const fullRangeMatch = t.match(
    new RegExp(`(?:dal?\\s+)?(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})\\s+(?:al?|[-–])\\s+(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})`)
  );
  if (fullRangeMatch) {
    const [, d1, m1, y1, d2, m2, y2] = fullRangeMatch;
    return {
      start: `${y1}-${ITALIAN_MONTHS[m1]}-${d1.padStart(2, "0")}`,
      end: `${y2}-${ITALIAN_MONTHS[m2]}-${d2.padStart(2, "0")}`,
    };
  }

  // Single date: "5 aprile 2026"
  const singleMatch = t.match(
    new RegExp(`(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})`)
  );
  if (singleMatch) {
    const [, d, month, year] = singleMatch;
    const date = `${year}-${ITALIAN_MONTHS[month]}-${d.padStart(2, "0")}`;
    return { start: date, end: date };
  }

  return { start: null, end: null };
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

  // No GPS coords from 2d2web → pending_geocode
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
    console.error(`[2d2web] Insert error: ${error.message}`);
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
    source_name:     "2d2web",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Listing page parser: extract event cards ---

function parseListingPage(
  html: string,
  provinceSlug: string,
  provinceCode: string,
  pageUrl: string
): NormalizedEvent[] {
  const $ = cheerio.load(html);
  const events: NormalizedEvent[] = [];

  // 2d2web.com event cards — try multiple common ASP.NET patterns
  // Each card typically has: title link, date text, location, description excerpt, image
  const cardSelectors = [
    ".event-card",
    ".sagra-card",
    ".list-item",
    ".evento",
    ".item-evento",
    "article",
    ".card",
    ".row .col",
    "table tr",
    ".panel",
    ".well",
    ".media",
  ];

  // First, try to find event cards with known selectors
  let $cards = $([]);
  for (const sel of cardSelectors) {
    const found = $(sel);
    if (found.length >= 2) {
      $cards = found;
      break;
    }
  }

  // Fallback: look for repeated structures containing links to event detail pages
  // 2d2web detail links typically go to /sagre-feste/dettaglio/ or similar
  if ($cards.length < 2) {
    // Find all links that look like event detail links
    const detailLinks = $('a[href*="dettaglio"], a[href*="scheda"], a[href*="evento"]');
    if (detailLinks.length >= 2) {
      // Use parent containers of these links as "cards"
      $cards = detailLinks.map((_i: number, el: cheerio.Element) => {
        // Walk up to find a reasonable container
        let parent = $(el).parent();
        for (let depth = 0; depth < 5; depth++) {
          if (parent.children().length > 1) return parent[0];
          parent = parent.parent();
        }
        return parent[0];
      });
    }
  }

  // Ultra-fallback: parse all links with titles that look like events
  if ($cards.length < 2) {
    console.log(`[2d2web] No card structure found, trying link-based extraction for ${pageUrl}`);

    // Find all links on the page that could be event titles
    $("a[href]").each((_i: number, el: cheerio.Element) => {
      const $a = $(el);
      const href = $a.attr("href") || "";
      const linkText = $a.text().trim();

      // Skip navigation/footer/header links
      if (!linkText || linkText.length < 8 || linkText.length > 200) return;
      if (isNoiseTitle(linkText)) return;

      // Must look like an event link (contains sagr, fest, event, dettaglio, etc.)
      const lowerHref = href.toLowerCase();
      if (
        !lowerHref.includes("sagr") &&
        !lowerHref.includes("fest") &&
        !lowerHref.includes("event") &&
        !lowerHref.includes("dettaglio") &&
        !lowerHref.includes("scheda")
      ) {
        return;
      }

      // Try to extract date from surrounding text
      const container = $a.closest("div, td, li, article, section");
      const containerText = container.text() || "";
      const { start: startDate, end: endDate } = parseItalianDates(containerText);

      // Try to extract city from surrounding text
      let city = "";
      // Look for text that mentions a location (often after a dash or in a separate element)
      const locationEl = container.find(".location, .luogo, .citta, .city, [class*='loc'], [class*='place']");
      if (locationEl.length > 0) {
        city = locationEl.first().text().trim();
      }
      if (!city) {
        // Try to extract city from text like "Padova - Abano Terme" or "a Cittadella"
        const cityMatch = containerText.match(/(?:a\s+|presso\s+|loc(?:alità)?\.?\s+|–\s*|-\s*)([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)*)/);
        if (cityMatch) city = cityMatch[1].trim();
      }
      if (!city) city = provinceSlug.charAt(0).toUpperCase() + provinceSlug.slice(1);

      // Try to get image
      let imageUrl: string | null = null;
      const img = container.find("img").first();
      if (img.length > 0) {
        const src = img.attr("src") || img.attr("data-src") || "";
        if (src && !isLowQualityUrl(src)) {
          imageUrl = src.startsWith("http") ? src : `https://www.2d2web.com${src.startsWith("/") ? "" : "/"}${src}`;
        }
      }

      // Try to get description
      let description: string | null = null;
      const descEl = container.find("p, .description, .desc, .excerpt, .testo, .abstract");
      if (descEl.length > 0) {
        description = decodeHtmlEntities(descEl.first().text().trim());
        if (description.length > 2000) description = description.slice(0, 2000);
        if (description.length < 10) description = null;
      }

      // Build absolute URL
      let eventUrl = href;
      if (!eventUrl.startsWith("http")) {
        eventUrl = `https://www.2d2web.com${eventUrl.startsWith("/") ? "" : "/"}${eventUrl}`;
      }

      const title = decodeHtmlEntities(linkText).slice(0, 200);

      // Apply filters
      if (isNonSagraTitle(title)) {
        console.log(`[2d2web] Skipping non-sagra: "${title}"`);
        return;
      }
      if (containsPastYear(title, eventUrl, description ?? undefined)) {
        console.log(`[2d2web] Skipping past year: "${title}"`);
        return;
      }

      // Skip past events
      if (startDate) {
        const eventEnd = endDate || startDate;
        if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
          console.log(`[2d2web] Skipping past event: "${title}" (ends ${eventEnd})`);
          return;
        }
      }

      events.push({
        title,
        normalizedTitle: normalizeText(title),
        slug: generateSlug(title, city),
        city,
        province: provinceCode,
        startDate,
        endDate: endDate || startDate,
        priceInfo: null,
        isFree: null,
        imageUrl,
        url: eventUrl,
        sourceDescription: description,
        contentHash: generateContentHash(title, city, startDate),
      });
    });

    return events;
  }

  // Parse structured cards
  $cards.each((_i: number, el: cheerio.Element) => {
    try {
      const $card = $(el);
      const cardText = $card.text().trim();
      if (!cardText || cardText.length < 10) return;

      // Find title: first prominent link or heading
      let title = "";
      let eventUrl = "";
      const titleEl =
        $card.find("h1 a, h2 a, h3 a, h4 a, h5 a, .title a, .titolo a, a.title, a.titolo").first();
      if (titleEl.length > 0) {
        title = titleEl.text().trim();
        eventUrl = titleEl.attr("href") || "";
      } else {
        // Try heading without link
        const heading = $card.find("h1, h2, h3, h4, h5, .title, .titolo").first();
        if (heading.length > 0) title = heading.text().trim();
        // Get first link as URL
        const firstLink = $card.find("a[href]").first();
        eventUrl = firstLink.attr("href") || "";
      }

      if (!title) return;
      title = decodeHtmlEntities(title).slice(0, 200);

      // Apply filters
      if (isNoiseTitle(title)) return;
      if (isNonSagraTitle(title)) {
        console.log(`[2d2web] Skipping non-sagra: "${title}"`);
        return;
      }

      // Build absolute URL
      if (eventUrl && !eventUrl.startsWith("http")) {
        eventUrl = `https://www.2d2web.com${eventUrl.startsWith("/") ? "" : "/"}${eventUrl}`;
      }
      if (!eventUrl) eventUrl = pageUrl;

      // Extract dates
      const { start: startDate, end: endDate } = parseItalianDates(cardText);

      if (containsPastYear(title, eventUrl, cardText)) {
        console.log(`[2d2web] Skipping past year: "${title}"`);
        return;
      }

      // Skip past events
      if (startDate) {
        const eventEnd = endDate || startDate;
        if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
          console.log(`[2d2web] Skipping past event: "${title}" (ends ${eventEnd})`);
          return;
        }
      }

      // Extract city
      let city = "";
      const locationEl = $card.find(".location, .luogo, .citta, .city, [class*='loc'], [class*='place']");
      if (locationEl.length > 0) {
        city = locationEl.first().text().trim();
      }
      if (!city) {
        // Try extracting from text patterns
        const cityMatch = cardText.match(
          /(?:a\s+|presso\s+|loc(?:alità)?\.?\s+|–\s*|-\s*)([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)*)/
        );
        if (cityMatch) city = cityMatch[1].trim();
      }
      // Strip province code from city if present: "Padova (PD)" → "Padova"
      city = city.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim();
      if (!city) city = provinceSlug.charAt(0).toUpperCase() + provinceSlug.slice(1);

      // Extract image
      let imageUrl: string | null = null;
      const img = $card.find("img").first();
      if (img.length > 0) {
        const src = img.attr("src") || img.attr("data-src") || "";
        if (src && !isLowQualityUrl(src)) {
          imageUrl = src.startsWith("http") ? src : `https://www.2d2web.com${src.startsWith("/") ? "" : "/"}${src}`;
        }
      }

      // Extract description
      let description: string | null = null;
      const descEl = $card.find("p, .description, .desc, .excerpt, .testo, .abstract").first();
      if (descEl.length > 0) {
        description = decodeHtmlEntities(descEl.text().trim());
        if (description.length > 2000) description = description.slice(0, 2000);
        if (description.length < 10) description = null;
      }

      events.push({
        title,
        normalizedTitle: normalizeText(title),
        slug: generateSlug(title, city),
        city,
        province: provinceCode,
        startDate,
        endDate: endDate || startDate,
        priceInfo: null,
        isFree: null,
        imageUrl,
        url: eventUrl,
        sourceDescription: description,
        contentHash: generateContentHash(title, city, startDate),
      });
    } catch (err) {
      console.error(`[2d2web] Card parse error:`, err);
    }
  });

  return events;
}

// --- Check if page has next page ---

function hasNextPage($: cheerio.CheerioAPI, currentPage: number): boolean {
  // Look for pagination links with ?pg=N+1
  const nextPageNum = currentPage + 1;
  const hasNext =
    $(`a[href*="pg=${nextPageNum}"]`).length > 0 ||
    $(`a:contains("${nextPageNum}")`).filter((_i: number, el: cheerio.Element) => {
      const href = $(el).attr("href") || "";
      return href.includes("pg=") || href.includes("page=") || href.includes("pag=");
    }).length > 0 ||
    $('a:contains("Successiva"), a:contains("Avanti"), a:contains(">>"), a:contains("›"), a.next, a.pager-next').length > 0;

  return hasNext;
}

// --- Main scraping logic ---

const BASE_URL = "https://www.2d2web.com/sagre-feste";
const MAX_PAGES_PER_PROVINCE = 5;
const SOURCE_NAME = "2d2web";
const DELAY_MS = 1500; // politeness delay

async function scrape2d2web(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  try {
    for (const provinceSlug of VENETO_PROVINCES) {
      // Time budget check (120s total, leave margin)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[2d2web] Time budget exceeded, stopping at province ${provinceSlug}`);
        break;
      }

      const provinceCode = PROVINCE_SLUG_TO_CODE[provinceSlug];
      console.log(`[2d2web] === Scraping province: ${provinceSlug} (${provinceCode}) ===`);

      for (let page = 1; page <= MAX_PAGES_PER_PROVINCE; page++) {
        // Time budget check within province loop
        if (Date.now() - startedAt > 110_000) {
          console.log(`[2d2web] Time budget exceeded during ${provinceSlug} page ${page}`);
          break;
        }

        const url = page === 1
          ? `${BASE_URL}/${provinceSlug}`
          : `${BASE_URL}/${provinceSlug}?pg=${page}`;

        console.log(`[2d2web] Fetching ${provinceSlug} page ${page}: ${url}`);

        const html = await fetchWithTimeout(url, 15_000);
        if (!html) {
          console.log(`[2d2web] No HTML for ${provinceSlug} page ${page}, stopping pagination`);
          break;
        }

        const events = parseListingPage(html, provinceSlug, provinceCode, url);
        console.log(`[2d2web] ${provinceSlug} page ${page}: parsed ${events.length} events`);

        if (events.length === 0) {
          // No events found — could be empty page or end of results
          break;
        }

        // Upsert each event
        for (const event of events) {
          totalFound++;
          const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
          if (result === "inserted") totalInserted++;
          else if (result === "merged") totalMerged++;
          else totalSkipped++;

          console.log(`[2d2web] ${result}: "${event.title}" (${event.city}, ${event.province})`);
        }

        // Check if there's a next page
        const $ = cheerio.load(html);
        if (!hasNextPage($, page)) {
          console.log(`[2d2web] No more pages for ${provinceSlug} after page ${page}`);
          break;
        }

        // Politeness delay between pages
        await new Promise(r => setTimeout(r, DELAY_MS));
      }

      // Politeness delay between provinces
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}`);
    console.log(`[2d2web] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[2d2web] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-2d2web] Starting — scraping 2d2web.com Veneto sagre listings`);

  EdgeRuntime.waitUntil(scrape2d2web(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "2d2web",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
