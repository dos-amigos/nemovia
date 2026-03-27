// =============================================================================
// scrape-invenicetoday — Scrape sagre/feste from invenicetoday.com
// Single page listing all Venice festivals month by month.
// URL: https://www.invenicetoday.com/eventi/feste.htm
// Province always "VE" (Venice province).
// Filters for food-related events (sagre, feste with gastronomic stands).
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
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "\u2026")
    .replace(/&egrave;/g, "\u00E8")
    .replace(/&agrave;/g, "\u00E0")
    .replace(/&ograve;/g, "\u00F2")
    .replace(/&ugrave;/g, "\u00F9")
    .replace(/&igrave;/g, "\u00EC")
    .replace(/&deg;/g, "\u00B0");
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
  if (/biglietto vaporetto|acquisto bigliett/i.test(t)) return true;
  return false;
}

function isNonSagraTitle(title: string): boolean {
  if (!title || title.length === 0) return false;
  const t = title.toLowerCase();
  // Whitelist: food-related keywords → keep
  if (
    /\b(sagra|sagre|festa|feste|gastronomic|enogastronomic|degustazion|polenta|baccal[aà]|pesce|peocio|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia|mosto|giuggiola|sardella|bisato|contrada|parrocchial)/i.test(t)
  ) {
    return false;
  }
  // Blacklist: non-food events → skip
  if (
    /\b(passeggiata|camminata|marcia)\b/i.test(t) ||
    /\bcarnevale\b/i.test(t) ||
    /\b(concerto|concerti|recital)\b/i.test(t) ||
    /\b(mostra|mostre|esposizione)\b/i.test(t) ||
    /\b(antiquariato|collezionismo)\b/i.test(t) ||
    /\b(teatro|teatrale|commedia|spettacolo)\b/i.test(t) ||
    /\b(maratona|marathon|corsa|gara\s+ciclistica|gara\s+podistica)\b/i.test(t) ||
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
    /\b(serata\s+danzante|ballo\s+liscio)\b/i.test(t) ||
    /\b(regata|regate|veleziana|voga)\b/i.test(t) ||
    /\b(fuochi|pirotecnic|fireworks)\b/i.test(t) ||
    /\b(messa|commemorazione|defunti|ognissanti)\b/i.test(t) ||
    /\b(premio|artigianato|fashion|sfilata|moda)\b/i.test(t) ||
    /\b(biennale|glass\s*week)\b/i.test(t) ||
    /\b(torneo|tennis|golf|sport)\b/i.test(t) ||
    /\b(battaglia|lepanto)\b/i.test(t)
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

// --- Food relevance filter ---
// Only keep events that have food/gastronomic content
function isFoodRelated(title: string, description: string | null): boolean {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  return /\b(sagra|sagre|gastronomic|enogastronomic|stand gastronomic|degustazion|polenta|baccal[aà]|pesce|peocio|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia|mosto|giuggiola|sardella|bisato|cucina|piatti|menu|cena|pranzo|cibo|food|contrada|parrocchial|rional|patron)/i.test(text);
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

// --- Anti-Asian food filter on image URLs (RULE N.1) ---
const ASIAN_FOOD_REGEX = /sushi|sashimi|chopstick|ramen|noodle|wok|dim[\s_-]?sum|bao|tofu|miso|wasabi|tempura|teriyaki|udon|soba|pho|pad[\s_-]?thai|kimchi|bibimbap|gyoza|dumpling|spring[\s_-]?roll|asian|chinese|japanese|korean|thai[\s_-]?food|vietnamese|oriental/i;

function hasAsianFoodInUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return ASIAN_FOOD_REGEX.test(url);
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

// --- Italian month names → month number ---
const ITALIAN_MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4,
  maggio: 5, giugno: 6, luglio: 7, agosto: 8,
  settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

// --- Date parser for Italian date strings ---
// Handles patterns like:
//   "Evento in corso il 25 aprile 2025"
//   "Eventi in corso dal 6 al 7 settembre 2025"
//   "Evento in corso dal 20 al 26 ottobre 2025"
//   "Eventi in corso il 1° e il 2 novembre"
//   "Festival in corso dal 26 settembre al 10 ottobre 2024"
//   "Festa in corso il 28 settembre 2025"
//   "Eventi in corso la notte del 14 agosto 2025"
function parseDateString(dateText: string): { startDate: string | null; endDate: string | null } {
  const text = dateText
    .replace(/&deg;/g, "°")
    .replace(/°/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const currentYear = new Date().getFullYear();

  // Extract explicit year if present
  const yearMatch = text.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;

  // Pattern 1: "dal DD al DD mese anno" or "dal DD mese al DD mese anno"
  const rangeMatch = text.match(
    /dal\s+(\d{1,2})\s+(?:al\s+)?(\d{1,2})?\s*(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)?\s*(?:al\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre))?/
  );

  if (rangeMatch) {
    const startDay = parseInt(rangeMatch[1]);

    // "dal DD mese al DD mese" (different months)
    if (rangeMatch[4] && rangeMatch[5]) {
      const startMonth = rangeMatch[3] ? ITALIAN_MONTHS[rangeMatch[3]] : ITALIAN_MONTHS[rangeMatch[5]];
      const endDay = parseInt(rangeMatch[4]);
      const endMonth = ITALIAN_MONTHS[rangeMatch[5]];
      if (startMonth && endMonth) {
        return {
          startDate: `${year}-${String(startMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`,
          endDate: `${year}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
        };
      }
    }

    // "dal DD al DD mese" (same month)
    if (rangeMatch[2] && rangeMatch[3]) {
      const month = ITALIAN_MONTHS[rangeMatch[3]];
      const endDay = parseInt(rangeMatch[2]);
      if (month) {
        return {
          startDate: `${year}-${String(month).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`,
          endDate: `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
        };
      }
    }

    // "dal DD mese" (single start date from range with missing end)
    if (rangeMatch[3]) {
      const month = ITALIAN_MONTHS[rangeMatch[3]];
      if (month) {
        const endDay = rangeMatch[4] ? parseInt(rangeMatch[4]) : startDay;
        const endMonth = rangeMatch[5] ? ITALIAN_MONTHS[rangeMatch[5]] : month;
        return {
          startDate: `${year}-${String(month).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`,
          endDate: `${year}-${String(endMonth ?? month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
        };
      }
    }
  }

  // Pattern 2: "il DD e il DD mese" or "il DD e DD mese"
  const twoDateMatch = text.match(
    /il\s+(\d{1,2})\s+e\s+(?:il\s+)?(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/
  );
  if (twoDateMatch) {
    const day1 = parseInt(twoDateMatch[1]);
    const day2 = parseInt(twoDateMatch[2]);
    const month = ITALIAN_MONTHS[twoDateMatch[3]];
    if (month) {
      return {
        startDate: `${year}-${String(month).padStart(2, "0")}-${String(day1).padStart(2, "0")}`,
        endDate: `${year}-${String(month).padStart(2, "0")}-${String(day2).padStart(2, "0")}`,
      };
    }
  }

  // Pattern 3: "il DD mese anno" (single date)
  const singleMatch = text.match(
    /(?:il|la notte del)\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/
  );
  if (singleMatch) {
    const day = parseInt(singleMatch[1]);
    const month = ITALIAN_MONTHS[singleMatch[2]];
    if (month) {
      return {
        startDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        endDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      };
    }
  }

  // Pattern 4: just "DD mese anno" without "il"
  const bareMatch = text.match(
    /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/
  );
  if (bareMatch) {
    const day = parseInt(bareMatch[1]);
    const month = ITALIAN_MONTHS[bareMatch[2]];
    if (month) {
      return {
        startDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        endDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      };
    }
  }

  return { startDate: null, endDate: null };
}

// --- Extract city from title/location text ---
// Patterns seen: "Festa X - Isola di Sant'Erasmo - Venezia"
//                "Sagra X - Pellestrina"
//                "Festa X - Piazzale Chiesa Nuova - Cavallino Treporti"
function extractCity(titleWithLocation: string): string {
  // Take text after the last " - " as city
  const parts = titleWithLocation.split(/\s+-\s+/);
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].trim();
    // Clean up common prefixes
    return lastPart
      .replace(/^(Isola di|Piazzale|Campo|Via|Piazza)\s+/i, "")
      .trim();
  }
  return "Venezia";
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
    console.error(`[invenicetoday] Insert error: ${error.message}`);
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
    source_name:     "invenicetoday",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Page parser: extract events from single listing page ---

function parseListingPage(html: string): NormalizedEvent[] {
  const $ = cheerio.load(html);
  const events: NormalizedEvent[] = [];
  const BASE = "https://www.invenicetoday.com";
  const today = new Date().toISOString().slice(0, 10);

  // Each event is in a <td> containing an <h3> with title/link/image
  // followed by a <p> with description.
  // Structure: <tr><td><h3><a href="..."><img ...> <strong>Title</strong> - Location</a>
  //   <br><strong>Date text</strong></h3><p>Description</p></td></tr>
  // Some events don't have an <a> link (just raw h3 text)

  $("h3").each((_i: number, h3El: cheerio.Element) => {
    try {
      const $h3 = $(h3El);
      const $td = $h3.closest("td");

      // --- Extract title and URL ---
      const $link = $h3.find("a").first();
      let rawTitle = "";
      let eventUrl = "";
      let imageUrl: string | null = null;

      if ($link.length > 0) {
        // Get href
        const href = $link.attr("href") ?? "";
        eventUrl = href.startsWith("http") ? href : `${BASE}${href.startsWith("/") ? "" : "/"}${href}`;

        // Get image
        const $img = $link.find("img").first();
        if ($img.length > 0) {
          const imgSrc = $img.attr("src") ?? "";
          imageUrl = imgSrc.startsWith("http") ? imgSrc : `${BASE}${imgSrc.startsWith("/") ? "" : "/"}${imgSrc}`;
        }

        // Get title from <strong> text inside the link (excluding img alt)
        // The text structure is: <a><img> <strong>Title</strong> - Location</a>
        const linkText = $link.text().trim();
        rawTitle = linkText;
      } else {
        // No link — get text directly from h3
        rawTitle = $h3.clone().children("br, strong").filter("br").remove().end().text().trim();
        if (!rawTitle) rawTitle = $h3.text().trim();

        // Try to get image directly in h3
        const $img = $h3.find("img").first();
        if ($img.length > 0) {
          const imgSrc = $img.attr("src") ?? "";
          imageUrl = imgSrc.startsWith("http") ? imgSrc : `${BASE}${imgSrc.startsWith("/") ? "" : "/"}${imgSrc}`;
        }
      }

      // --- Extract date string from <strong> inside h3 ---
      let dateText = "";
      $h3.find("strong").each((_j: number, strongEl: cheerio.Element) => {
        const text = $(strongEl).text().trim();
        if (/in corso|evento|eventi|festa|regata|festival/i.test(text) && /\d/.test(text)) {
          dateText = text;
        }
      });

      // --- Extract description from sibling <p> ---
      let description: string | null = null;
      const $p = $td.find("p").first();
      if ($p.length > 0) {
        description = decodeHtmlEntities($p.text().trim().replace(/\s+/g, " "));
        if (description.length > 2000) description = description.slice(0, 2000);
        if (description.length < 10) description = null;
      }

      // --- Clean title ---
      // Remove date portion from the raw title text
      // The raw text often includes "Title - Location\n\nDate text"
      let title = rawTitle;
      if (dateText) {
        title = title.replace(dateText, "").trim();
      }
      // Remove trailing date-like patterns
      title = title.replace(/\s*(Eventi?|Festa|Regata|Festival)\s+in\s+corso.*$/i, "").trim();
      // Clean up whitespace and dashes
      title = title.replace(/\s+/g, " ").replace(/\s*-\s*$/, "").trim();
      title = decodeHtmlEntities(title);

      if (!title || title.length < 5) return;

      // --- Apply filters ---
      if (isNoiseTitle(title)) {
        console.log(`[invenicetoday] Skipping noise: "${title}"`);
        return;
      }
      if (isNonSagraTitle(title)) {
        console.log(`[invenicetoday] Skipping non-sagra: "${title}"`);
        return;
      }

      // --- Food relevance check ---
      if (!isFoodRelated(title, description)) {
        console.log(`[invenicetoday] Skipping non-food event: "${title}"`);
        return;
      }

      // --- Parse dates ---
      const { startDate, endDate } = parseDateString(dateText);

      // Skip events without dates
      if (!startDate) {
        console.log(`[invenicetoday] Skipping "${title}" — no date parsed from: "${dateText}"`);
        return;
      }

      // Apply past year filter
      if (containsPastYear(title, eventUrl, description ?? undefined)) {
        console.log(`[invenicetoday] Skipping past year: "${title}"`);
        return;
      }

      // Skip past events
      const eventEnd = endDate || startDate;
      if (eventEnd < today) {
        console.log(`[invenicetoday] Skipping past event: "${title}" (ends ${eventEnd})`);
        return;
      }

      // --- Image quality + anti-Asian filter ---
      if (isLowQualityUrl(imageUrl)) {
        imageUrl = null;
      }
      if (hasAsianFoodInUrl(imageUrl)) {
        console.log(`[invenicetoday] Blocking Asian food image URL: ${imageUrl}`);
        imageUrl = null;
      }

      // --- Extract city ---
      let city = extractCity(title);
      // Many events are in Venice proper or surrounding areas
      if (!city || city.length < 2) city = "Venezia";
      // Clean up "Venezia" from the title for city extraction
      // e.g. "Festa del Mosto - Isola di Sant'Erasmo - Venezia" → city = "Venezia"
      // but we want "Sant'Erasmo" as the more specific location
      const titleParts = title.split(/\s+-\s+/);
      if (titleParts.length >= 3) {
        // Take the second-to-last part as more specific location
        const specificLoc = titleParts[titleParts.length - 2].trim()
          .replace(/^(Isola di|Piazzale|Campo|Via|Piazza)\s+/i, "")
          .trim();
        if (specificLoc && specificLoc.length > 2 && specificLoc.toLowerCase() !== "venezia") {
          city = specificLoc;
        }
      }

      // Clean title: remove location suffix for the stored title
      const cleanTitle = titleParts[0].trim();

      const event: NormalizedEvent = {
        title: cleanTitle.slice(0, 200),
        normalizedTitle: normalizeText(cleanTitle),
        slug: generateSlug(cleanTitle, city),
        city,
        province: "VE",
        startDate,
        endDate: endDate || startDate,
        priceInfo: null,
        isFree: null,
        imageUrl,
        url: eventUrl || `https://www.invenicetoday.com/eventi/feste.htm`,
        sourceDescription: description,
        contentHash: generateContentHash(cleanTitle, city, startDate),
      };

      // Deduplicate within this page parse (same title+city)
      const key = `${event.normalizedTitle}|${normalizeText(event.city)}`;
      if (!events.some(e => `${e.normalizedTitle}|${normalizeText(e.city)}` === key)) {
        events.push(event);
      }
    } catch (err) {
      console.error(`[invenicetoday] Error parsing h3 element:`, err);
    }
  });

  return events;
}

// --- Main scraping logic ---

const PAGE_URL = "https://www.invenicetoday.com/eventi/feste.htm";
const SOURCE_NAME = "invenicetoday";

async function scrapeInVeniceToday(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  try {
    console.log(`[invenicetoday] Fetching listing page: ${PAGE_URL}`);
    const html = await fetchWithTimeout(PAGE_URL, 20_000);

    if (!html) {
      console.error(`[invenicetoday] Failed to fetch page`);
      await logRun(supabase, "error", 0, 0, 0, "Failed to fetch listing page", startedAt);
      return;
    }

    console.log(`[invenicetoday] Page fetched, parsing events...`);
    const events = parseListingPage(html);
    totalFound = events.length;
    console.log(`[invenicetoday] Parsed ${totalFound} food-related events`);

    for (const event of events) {
      // Time budget check (120s total)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[invenicetoday] Time budget exceeded, stopping`);
        break;
      }

      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[invenicetoday] ${result}: "${event.title}" (${event.city}, ${event.startDate})`);
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}`);
    console.log(`[invenicetoday] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[invenicetoday] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-invenicetoday] Starting — scraping invenicetoday.com Venice festivals`);

  EdgeRuntime.waitUntil(scrapeInVeniceToday(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "invenicetoday",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
