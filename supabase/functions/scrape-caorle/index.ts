// =============================================================================
// scrape-caorle — Scrape sagre/feste from caorle.eu (official Caorle tourism)
// Two sources:
//   1. Sagre listing page (/it/gusta/sagre-di-paese/sagre-di-paese) — plain text
//   2. Top events page (/it/vivi/top-events/tutti) — links to detail pages
// City is always "Caorle", province always "VE".
// Only Caorle events (skips "dintorni" / surrounding areas).
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
  // Whitelist food/sagra keywords
  if (
    /\b(sagra|sagre|festa|feste|gastronomic|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia)/i.test(t)
  ) {
    return false;
  }
  // Blacklist non-sagra event types
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
  /place-holder/i,
  /flag_/i,
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

// --- Month name to number mapping (Italian) ---

const MONTH_MAP: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

/**
 * Parse an Italian month name into a number (1-12), or null.
 */
function parseMonthName(text: string): number | null {
  const t = text.trim().toLowerCase();
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (t.includes(name)) return num;
  }
  return null;
}

/**
 * Given a month number, estimate start/end dates for the current (or next) year.
 * If the month is in the past for current year, use next year.
 * Returns [startDate, endDate] as YYYY-MM-DD strings (first and last day of month).
 */
function estimateDatesFromMonth(month: number): [string, string] {
  const now = new Date();
  let year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  // If the month already passed this year, assume next year
  if (month < currentMonth) {
    year += 1;
  }
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  // Last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return [startDate, endDate];
}

/**
 * Try to extract specific dates from text like "27 e 28 settembre" or "dal 15 al 20 agosto".
 * Returns [startDate, endDate] or null.
 */
function extractSpecificDates(text: string): [string, string] | null {
  const now = new Date();
  let year = now.getFullYear();

  // Match "NN e NN mese" or "NN-NN mese"
  const rangeMatch = text.match(
    /(\d{1,2})\s*(?:e|,|-|\/)\s*(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/i
  );
  if (rangeMatch) {
    const day1 = parseInt(rangeMatch[1]);
    const day2 = parseInt(rangeMatch[2]);
    const month = parseMonthName(rangeMatch[3]);
    if (month) {
      if (month < now.getMonth() + 1) year += 1;
      const start = `${year}-${String(month).padStart(2, "0")}-${String(day1).padStart(2, "0")}`;
      const end = `${year}-${String(month).padStart(2, "0")}-${String(day2).padStart(2, "0")}`;
      return [start, end];
    }
  }

  // Match "dal NN al NN mese" or "dal NN mese al NN mese"
  const dalAlMatch = text.match(
    /dal\s+(\d{1,2})\s+(?:(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+)?al\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/i
  );
  if (dalAlMatch) {
    const day1 = parseInt(dalAlMatch[1]);
    const month1 = dalAlMatch[2] ? parseMonthName(dalAlMatch[2]) : parseMonthName(dalAlMatch[4]);
    const day2 = parseInt(dalAlMatch[3]);
    const month2 = parseMonthName(dalAlMatch[4]);
    if (month1 && month2) {
      if (month2 < now.getMonth() + 1) year += 1;
      const start = `${year}-${String(month1).padStart(2, "0")}-${String(day1).padStart(2, "0")}`;
      const end = `${year}-${String(month2).padStart(2, "0")}-${String(day2).padStart(2, "0")}`;
      return [start, end];
    }
  }

  // Match single "NN mese"
  const singleMatch = text.match(
    /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/i
  );
  if (singleMatch) {
    const day = parseInt(singleMatch[1]);
    const month = parseMonthName(singleMatch[2]);
    if (month) {
      if (month < now.getMonth() + 1) year += 1;
      const d = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return [d, d];
    }
  }

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
      // Slug or content_hash collision — retry with unique suffix
      insertData.slug = event.slug + "-" + Date.now().toString(36);
      insertData.content_hash = event.contentHash + Date.now().toString(36);
      const { data: retryData } = await supabase.from("sagre")
        .insert(insertData)
        .select("id")
        .single();
      return { result: "inserted", id: retryData?.id };
    }
    console.error(`[caorle] Insert error: ${error.message}`);
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
    source_name:     "caorle",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Parse the sagre-di-paese listing page (plain text entries) ---

function parseSagreListingPage(html: string): NormalizedEvent[] {
  const $ = cheerio.load(html);
  const events: NormalizedEvent[] = [];
  const pageUrl = "https://www.caorle.eu/it/gusta/sagre-di-paese/sagre-di-paese";

  // The page has plain text entries with month headers in <strong>, event names in <strong>,
  // and location/time info in surrounding text, separated by <hr>.
  // We need to parse the main content area.

  // Get all text content from the main body
  // Remove nav, header, footer to focus on content
  $("nav, header, footer, script, style").remove();

  const bodyHtml = $.html();

  // Strategy: find sections by looking for month headers and event names in bold
  // The page structure is roughly:
  //   <strong>MONTH</strong>
  //   <strong>SAGRA NAME</strong>
  //   Location - Time info
  //   <hr>

  // We'll look for patterns in the text. First, let's identify the "Caorle" section
  // and skip the "Nei dintorni" (surrounding areas) section.
  const bodyText = $("body").text();

  // Split content at "Nei dintorni" or "DINTORNI" to only process Caorle events
  const caorleSection = bodyText.split(/nei\s+dintorni/i)[0] || bodyText;

  // Extract event blocks: look for sagra/festa names
  // Pattern: capitalized event name followed by location and time
  const eventPatterns = [
    // "SAGRA DI SANSONESSA" style
    /\b(SAGRA\s+D[EI]\w*\s+[\w\s]+?)(?:\s*[-–]\s*|\s+)((?:Ecopark|Loc\.|Via\s|Strada\s|Piazza\s|Centro\s|Castello\s)[\w\s.,]+?)(?:\s*[-–]\s*)?(?:(?:ore\s+)?(\d{1,2}[.:]\d{2})\s*[-–]\s*(\d{1,2}[.:]\d{2})|(?:dalle\s+)?(?:ore\s+)?(\d{1,2}[.:]\d{2}))?/gi,
    // "FESTA PATRONALE" style
    /\b(FESTA\s+[\w\s]+?)(?:\s*[-–]\s*|\s+)((?:Ecopark|Loc\.|Via\s|Strada\s|Piazza\s|Centro\s|Castello\s)[\w\s.,]+?)(?:\s*[-–]\s*)?(?:(?:ore\s+)?(\d{1,2}[.:]\d{2})\s*[-–]\s*(\d{1,2}[.:]\d{2})|(?:dalle\s+)?(?:ore\s+)?(\d{1,2}[.:]\d{2}))?/gi,
  ];

  // Better approach: parse the HTML looking for bold text as event markers
  const contentHtml = $("body").html() || "";

  // Find all <strong> or <b> elements that could be event names
  const strongTexts: string[] = [];
  $("strong, b").each((_i: number, el: cheerio.Element) => {
    const text = $(el).text().trim();
    if (text.length > 3) strongTexts.push(text);
  });

  // Track which month we're in
  let currentMonth: number | null = null;
  let inDintorni = false;

  for (let i = 0; i < strongTexts.length; i++) {
    const text = strongTexts[i];

    // Check if we've entered "dintorni" section — skip everything after
    if (/dintorni/i.test(text)) {
      inDintorni = true;
      continue;
    }
    if (inDintorni) continue;

    // Check if it's a month header
    const month = parseMonthName(text);
    if (month !== null && text.trim().length <= 12) {
      currentMonth = month;
      continue;
    }

    // Check if it's a sagra/festa name
    const titleRaw = text.trim();
    if (!/sagra|festa|pesce/i.test(titleRaw)) continue;
    if (isNoiseTitle(titleRaw)) continue;

    // Clean up the title
    const title = decodeHtmlEntities(titleRaw).replace(/\s+/g, " ").trim();
    if (isNonSagraTitle(title)) continue;

    // Determine dates
    let startDate: string | null = null;
    let endDate: string | null = null;

    // Look at surrounding text for specific dates
    // Check the next strong text and text between for date clues
    const nextTexts = strongTexts.slice(i + 1, i + 3).join(" ");
    const specificDates = extractSpecificDates(`${title} ${nextTexts}`);
    if (specificDates) {
      [startDate, endDate] = specificDates;
    } else if (currentMonth) {
      [startDate, endDate] = estimateDatesFromMonth(currentMonth);
    }

    // Skip past events
    if (startDate) {
      const eventEnd = endDate || startDate;
      if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
        console.log(`[caorle] Skipping past event: "${title}" (ends ${eventEnd})`);
        continue;
      }
    }

    // Skip events without any date
    if (!startDate) {
      console.log(`[caorle] Skipping "${title}" — no date available`);
      continue;
    }

    if (containsPastYear(title)) {
      console.log(`[caorle] Skipping past year: "${title}"`);
      continue;
    }

    const normalizedTitle = normalizeText(title);

    // Avoid adding duplicate titles
    if (events.some(e => e.normalizedTitle === normalizedTitle)) continue;

    events.push({
      title: title.slice(0, 200),
      normalizedTitle,
      slug: generateSlug(title, "Caorle"),
      city: "Caorle",
      province: "VE",
      startDate,
      endDate: endDate || startDate,
      priceInfo: null,
      isFree: null,
      imageUrl: null,
      url: pageUrl,
      sourceDescription: `${title} — Caorle (VE). Evento della tradizione caorlesana.`,
      contentHash: generateContentHash(title, "Caorle", startDate),
    });
  }

  return events;
}

// --- Parse the top-events listing page (links to detail pages) ---

function extractTopEventLinks(html: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];

  $("a[href]").each((_i: number, el: cheerio.Element) => {
    const href = $(el).attr("href");
    if (!href) return;
    // Match top-events detail pages
    if (/caorle\.eu\/it\/vivi\/top-events\/[^/]+$/i.test(href) && !/\/tutti$/i.test(href)) {
      const fullUrl = href.startsWith("http") ? href : `https://www.caorle.eu${href}`;
      if (!links.includes(fullUrl)) links.push(fullUrl);
    }
    // Also match gusta detail pages (e.g., festa-del-pesce)
    if (/caorle\.eu\/it\/gusta\/[^/]+\/[^/]+$/i.test(href)) {
      const fullUrl = href.startsWith("http") ? href : `https://www.caorle.eu${href}`;
      // Skip the sagre-di-paese listing page itself
      if (!/sagre-di-paese/i.test(fullUrl) && !links.includes(fullUrl)) {
        links.push(fullUrl);
      }
    }
  });

  return links;
}

// --- Parse a detail page for a single event ---

function parseDetailPage(html: string, sourceUrl: string): NormalizedEvent | null {
  const $ = cheerio.load(html);

  // Extract title from h1
  const titleRaw = $("h1").first().text().trim();
  if (!titleRaw) return null;

  const title = decodeHtmlEntities(titleRaw).replace(/\s+/g, " ").trim();

  // Apply filters
  if (isNoiseTitle(title)) {
    console.log(`[caorle] Skipping noise title: "${title}"`);
    return null;
  }
  // For top-events, be more permissive — only skip clearly non-food events
  // but still apply the non-sagra filter for things like airshows, regattas, etc.
  if (isNonSagraTitle(title)) {
    console.log(`[caorle] Skipping non-sagra title: "${title}"`);
    return null;
  }
  // Also skip events that are clearly not food-related from top-events
  if (/\b(airshow|frecce\s+tricolori|regate|regata|film\s+festival|piano\s+festival|oltremare|christmas|incendio|pirotecnic|processione|scogliera\s*viva)\b/i.test(title)) {
    // Only keep if it's clearly food-related
    if (!/\b(sagra|festa.*pesce|festa.*cibo|gastronomic|enogastronomic|polenta|baccal[aà])/i.test(title)) {
      console.log(`[caorle] Skipping non-food top event: "${title}"`);
      return null;
    }
  }

  // Extract description
  let description: string | null = null;
  // Look for main content: h2 subtitle + paragraphs
  const subtitle = $("h2").first().text().trim();
  const paragraphs: string[] = [];
  if (subtitle) paragraphs.push(subtitle);

  // Collect paragraph texts from main content
  $("p").each((_i: number, el: cheerio.Element) => {
    const text = $(el).text().trim();
    if (text.length > 20 && !/cookie|privacy|copyright/i.test(text)) {
      paragraphs.push(text);
    }
  });

  if (paragraphs.length > 0) {
    description = paragraphs.slice(0, 5).join("\n\n");
    description = decodeHtmlEntities(description).replace(/\s+/g, " ").trim();
    if (description.length > 2000) description = description.slice(0, 2000);
    if (description.length < 10) description = null;
  }

  // Extract dates from page text
  const bodyText = $("body").text();
  let startDate: string | null = null;
  let endDate: string | null = null;

  const specificDates = extractSpecificDates(bodyText);
  if (specificDates) {
    [startDate, endDate] = specificDates;
  } else {
    // Try month-only
    const monthMatch = bodyText.match(
      /\b(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/i
    );
    if (monthMatch) {
      const month = parseMonthName(monthMatch[1]);
      if (month) {
        [startDate, endDate] = estimateDatesFromMonth(month);
      }
    }
  }

  // Apply past year filter
  if (containsPastYear(title, sourceUrl, description ?? undefined)) {
    console.log(`[caorle] Skipping past year: "${title}"`);
    return null;
  }

  // Skip past events
  if (startDate) {
    const eventEnd = endDate || startDate;
    if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
      console.log(`[caorle] Skipping past event: "${title}" (ends ${eventEnd})`);
      return null;
    }
  }

  // Skip events without any date
  if (!startDate) {
    console.log(`[caorle] Skipping "${title}" — no date available`);
    return null;
  }

  // Extract image
  let imageUrl: string | null = null;
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && !isLowQualityUrl(ogImage)) {
    imageUrl = ogImage.startsWith("http") ? ogImage : `https://www.caorle.eu${ogImage}`;
  }
  // Try gallery images
  if (!imageUrl) {
    $("img").each((_i: number, el: cheerio.Element) => {
      if (imageUrl) return; // already found one
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (!src) return;
      if (isLowQualityUrl(src)) return;
      // Skip tiny images (nav icons, etc.)
      const width = parseInt($(el).attr("width") || "0");
      if (width > 0 && width < 100) return;
      // Only images from /public/Gallery or content images
      if (/\/(Gallery|public)\//i.test(src) || /\.(jpg|jpeg|png|webp)$/i.test(src)) {
        imageUrl = src.startsWith("http") ? src : `https://www.caorle.eu${src}`;
      }
    });
  }

  // Price info
  let priceInfo: string | null = null;
  let isFree: boolean | null = null;
  if (/ingresso\s*(gratuito|libero|free)/i.test(bodyText) || /entr(ata|ée?)\s*(gratuita|libera|free)/i.test(bodyText)) {
    isFree = true;
    priceInfo = "Ingresso gratuito";
  }

  return {
    title: title.slice(0, 200),
    normalizedTitle: normalizeText(title),
    slug: generateSlug(title, "Caorle"),
    city: "Caorle",
    province: "VE",
    startDate,
    endDate: endDate || startDate,
    priceInfo,
    isFree,
    imageUrl,
    url: sourceUrl,
    sourceDescription: description,
    contentHash: generateContentHash(title, "Caorle", startDate),
  };
}

// --- Main scraping logic ---

const SOURCE_NAME = "caorle";
const DELAY_MS = 1500; // politeness delay
const SAGRE_URL = "https://www.caorle.eu/it/gusta/sagre-di-paese/sagre-di-paese";
const TOP_EVENTS_URL = "https://www.caorle.eu/it/vivi/top-events/tutti";
const FESTA_PESCE_URL = "https://www.caorle.eu/it/gusta/la-festa-del-pesce/la-festa-del-pesce";

async function scrapeCaorle(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  const seenNormalized = new Set<string>();

  try {
    // =====================================================================
    // Phase 1: Parse the sagre-di-paese listing page (plain text entries)
    // =====================================================================
    console.log(`[caorle] Fetching sagre listing: ${SAGRE_URL}`);
    const sagreHtml = await fetchWithTimeout(SAGRE_URL, 15_000);

    if (sagreHtml) {
      const sagreEvents = parseSagreListingPage(sagreHtml);
      console.log(`[caorle] Sagre listing: parsed ${sagreEvents.length} events`);

      for (const event of sagreEvents) {
        if (seenNormalized.has(event.normalizedTitle)) continue;
        seenNormalized.add(event.normalizedTitle);
        totalFound++;

        const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
        if (result === "inserted") totalInserted++;
        else if (result === "merged") totalMerged++;
        else totalSkipped++;

        console.log(`[caorle] ${result}: "${event.title}" (${event.startDate})`);
      }
    } else {
      console.log(`[caorle] Failed to fetch sagre listing`);
    }

    await new Promise(r => setTimeout(r, DELAY_MS));

    // =====================================================================
    // Phase 2: Fetch top-events page and follow detail links
    // =====================================================================
    console.log(`[caorle] Fetching top events: ${TOP_EVENTS_URL}`);
    const topEventsHtml = await fetchWithTimeout(TOP_EVENTS_URL, 15_000);

    const detailUrls: string[] = [];
    if (topEventsHtml) {
      const links = extractTopEventLinks(topEventsHtml);
      console.log(`[caorle] Top events page: found ${links.length} detail links`);
      detailUrls.push(...links);
    } else {
      console.log(`[caorle] Failed to fetch top events page`);
    }

    // Always include the Festa del Pesce page (main sagra)
    if (!detailUrls.some(u => /festa.*pesce/i.test(u))) {
      detailUrls.push(FESTA_PESCE_URL);
    }

    // Phase 3: Fetch each detail page
    for (const detailUrl of detailUrls) {
      // Time budget check (120s total)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[caorle] Time budget exceeded, stopping`);
        break;
      }

      await new Promise(r => setTimeout(r, DELAY_MS));

      console.log(`[caorle] Fetching detail: ${detailUrl}`);
      const html = await fetchWithTimeout(detailUrl, 10_000);
      if (!html) {
        console.log(`[caorle] Failed to fetch: ${detailUrl}`);
        continue;
      }

      const event = parseDetailPage(html, detailUrl);
      if (!event) continue;

      // Skip if we already processed this title from the listing page
      if (seenNormalized.has(event.normalizedTitle)) {
        console.log(`[caorle] Skipping duplicate: "${event.title}"`);
        continue;
      }
      seenNormalized.add(event.normalizedTitle);

      totalFound++;
      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[caorle] ${result}: "${event.title}" (${event.startDate})`);
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, detail_urls=${detailUrls.length}`);
    console.log(`[caorle] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[caorle] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-caorle] Starting — scraping caorle.eu sagre and top events`);

  EdgeRuntime.waitUntil(scrapeCaorle(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "caorle",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
