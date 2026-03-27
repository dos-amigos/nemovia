// =============================================================================
// scrape-gardaclick — Scrape sagre/food events from gardaclick.com
// Fetches the main events calendar page (static HTML table), parses rows,
// filters for Veneto (VR province) food/sagre events only.
// Lake Garda area — mostly VR province towns.
// No detail pages needed — all data is in the listing table.
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
    /\b(sagra|sagre|festa|feste|gastronomic|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia|olio|cioccolat|broccol|sardel|street\s*food|chiaretto|uva|renga)/i.test(t)
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
    /\b(serata\s+danzante|ballo\s+liscio)\b/i.test(t) ||
    /\b(triathlon|trail|bike|cycling|run|running|marathon|granfondo)\b/i.test(t) ||
    /\b(rally|raduno|auto|moto|motori)\b/i.test(t) ||
    /\b(apertura|parco|gardaland|aquapark|movieland)\b/i.test(t) ||
    /\b(olimpic|cerimonia)\b/i.test(t) ||
    /\b(hospitality|expo|model\s+expo)\b/i.test(t) ||
    /\b(coppa|gara)\b/i.test(t) ||
    /\b(bonsai|botanica|fiori|giardini)\b/i.test(t) ||
    /\b(musica|musicae|love)\b/i.test(t) ||
    /\b(vintage|game)\b/i.test(t) ||
    /\b(medievale|assedio|rocca)\b/i.test(t) ||
    /\b(nuoto|fondo\s+nel|symphony|fire)\b/i.test(t) ||
    /\b(fiaba|notte)\b/i.test(t)
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

// --- Anti-Asian food filter (RULE: applied on ALL image URLs) ---

const ASIAN_FOOD_REGEX = /\b(asian|sushi|chopstick|ramen|chinese|japanese|wok|noodle|dim[\s_-]?sum|bao|gyoza|tempura|teriyaki|wasabi|miso|tofu|pad[\s_-]?thai|pho|bibimbap|kimchi|dumpling|udon|soba|sake|matcha|bento|onigiri|mochi|dango|takoyaki|okonomiyaki|yakitori|tonkatsu|katsu|sashimi|nigiri|maki|edamame|seaweed|nori|spring[\s_-]?roll|egg[\s_-]?roll|fried[\s_-]?rice|lo[\s_-]?mein|chow[\s_-]?mein|szechuan|kung[\s_-]?pao|sweet[\s_-]?sour|hoisin|sriracha|samosa|curry|tandoori|tikka|masala|vindaloo|biryani)\b/i;

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

// --- Veneto (VR province) towns on Lake Garda ---
// Only towns in Verona province. We skip BS (Lombardia) and TN (Trentino) towns.

const VENETO_GARDA_TOWNS: Record<string, string> = {
  // Primary Garda Veneto towns
  "bardolino": "Bardolino",
  "brenzone sul garda": "Brenzone sul Garda",
  "brenzone": "Brenzone sul Garda",
  "castelnuovo del garda": "Castelnuovo del Garda",
  "garda": "Garda",
  "lazise": "Lazise",
  "malcesine": "Malcesine",
  "peschiera del garda": "Peschiera del Garda",
  "torri del benaco": "Torri del Benaco",
  // Other VR province towns near the lake
  "affi": "Affi",
  "bussolengo": "Bussolengo",
  "caprino veronese": "Caprino Veronese",
  "castelnuovo": "Castelnuovo del Garda",
  "cavaion veronese": "Cavaion Veronese",
  "cavaion v.se": "Cavaion Veronese",
  "costermano": "Costermano sul Garda",
  "costermano sul garda": "Costermano sul Garda",
  "garda veneto": "Garda",
  "lago di garda": "Lago di Garda",  // generic — keep as VR
  "pastrengo": "Pastrengo",
  "rivoli veronese": "Rivoli Veronese",
  "san zeno di montagna": "San Zeno di Montagna",
  "sant'ambrogio di valpolicella": "Sant'Ambrogio di Valpolicella",
  "sommacampagna": "Sommacampagna",
  "sona": "Sona",
  "valeggio sul mincio": "Valeggio sul Mincio",
  "valeggio": "Valeggio sul Mincio",
  "verona": "Verona",
  "fiera di verona": "Verona",
  "villafranca di verona": "Villafranca di Verona",
  "negrar": "Negrar di Valpolicella",
  "negrar di valpolicella": "Negrar di Valpolicella",
  "san pietro in cariano": "San Pietro in Cariano",
  "fumane": "Fumane",
  "dolcè": "Dolcè",
  "ferrara di monte baldo": "Ferrara di Monte Baldo",
  "san giovanni lupatoto": "San Giovanni Lupatoto",
};

function resolveVenetoCity(rawCity: string): { city: string; isVeneto: boolean } {
  const cleaned = rawCity.trim();
  const key = cleaned.toLowerCase();

  // Direct match
  if (VENETO_GARDA_TOWNS[key]) {
    return { city: VENETO_GARDA_TOWNS[key], isVeneto: true };
  }

  // Partial match: check if any known town is contained in the city text
  for (const [townKey, townName] of Object.entries(VENETO_GARDA_TOWNS)) {
    if (key.includes(townKey) || townKey.includes(key)) {
      return { city: townName, isVeneto: true };
    }
  }

  // Cities that contain "bardolino", "lazise", etc. as substring
  for (const [townKey, townName] of Object.entries(VENETO_GARDA_TOWNS)) {
    if (key.startsWith(townKey) || key.endsWith(townKey)) {
      return { city: townName, isVeneto: true };
    }
  }

  return { city: cleaned, isVeneto: false };
}

// --- Month name to number mapping ---

const MONTH_MAP: Record<string, number> = {
  "gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4,
  "maggio": 5, "giugno": 6, "luglio": 7, "agosto": 8,
  "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12,
};

// --- Date parsing ---
// Gardaclick uses formats like:
//   "10-11"           → single month, day range
//   "30-3\02"         → cross-month (Jan 30 to Feb 3) — note the backslash typo
//   "21-24/05"        → range ending in different month (Mar 21 to May 24)
//   "15 & 17"         → two separate days (use first as start, second as end)
//   "2"               → single day
//   "12-25"           → day range within month
//   "5-7"             → day range within month

function parseDateCell(rawDate: string, currentMonth: number, currentYear: number): { start: string | null; end: string | null } {
  const cleaned = rawDate.replace(/\\0?/g, "/").trim(); // fix "\02" → "/2"

  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

  // Format: "21-24/05" → start day 21 current month, end day 24 month 05
  const crossMonthSlash = cleaned.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\/(\d{1,2})$/);
  if (crossMonthSlash) {
    const startDay = parseInt(crossMonthSlash[1], 10);
    const endDay = parseInt(crossMonthSlash[2], 10);
    const endMonth = parseInt(crossMonthSlash[3], 10);
    return {
      start: fmt(currentYear, currentMonth, startDay),
      end: fmt(currentYear, endMonth, endDay),
    };
  }

  // Format: "30-3/2" or "28-1" (cross-month range, end day < start day)
  const rangeMatch = cleaned.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})(?:\/(\d{1,2}))?$/);
  if (rangeMatch) {
    const startDay = parseInt(rangeMatch[1], 10);
    const endDay = parseInt(rangeMatch[2], 10);
    const explicitEndMonth = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : null;

    if (explicitEndMonth) {
      return {
        start: fmt(currentYear, currentMonth, startDay),
        end: fmt(currentYear, explicitEndMonth, endDay),
      };
    }

    if (endDay < startDay) {
      // Cross-month: end is in the next month
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      return {
        start: fmt(currentYear, currentMonth, startDay),
        end: fmt(nextYear, nextMonth, endDay),
      };
    }

    return {
      start: fmt(currentYear, currentMonth, startDay),
      end: fmt(currentYear, currentMonth, endDay),
    };
  }

  // Format: "15 & 17" → two days
  const ampMatch = cleaned.match(/^(\d{1,2})\s*&\s*(\d{1,2})$/);
  if (ampMatch) {
    const day1 = parseInt(ampMatch[1], 10);
    const day2 = parseInt(ampMatch[2], 10);
    return {
      start: fmt(currentYear, currentMonth, day1),
      end: fmt(currentYear, currentMonth, day2),
    };
  }

  // Format: single day "2", "12"
  const singleDay = cleaned.match(/^(\d{1,2})$/);
  if (singleDay) {
    const day = parseInt(singleDay[1], 10);
    return {
      start: fmt(currentYear, currentMonth, day),
      end: fmt(currentYear, currentMonth, day),
    };
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

  // No GPS coords from gardaclick → pending_geocode
  const insertData: Record<string, unknown> = {
    title:              event.title,
    slug:               event.slug,
    location_text:      event.city,
    province:           "VR",          // All gardaclick Veneto events are VR
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
    console.error(`[gardaclick] Insert error: ${error.message}`);
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
    source_name:     "gardaclick",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Main HTML parser ---

function parseEventsTable(html: string, year: number): NormalizedEvent[] {
  const $ = cheerio.load(html);
  const events: NormalizedEvent[] = [];
  let currentMonth = 0;

  // Find the events table
  const rows = $("table.table tbody tr");

  rows.each((_i: number, row: cheerio.Element) => {
    const $row = $(row);

    // Check if this is a month header row
    if ($row.hasClass("table-primary")) {
      const headerText = $row.find("td.intestazione-tabella").text().trim().toLowerCase();
      if (MONTH_MAP[headerText]) {
        currentMonth = MONTH_MAP[headerText];
      }
      return; // skip header rows
    }

    if (currentMonth === 0) return; // no month context yet

    // Parse event row: 3 columns — date, city, event name
    const cells = $row.find("td");
    if (cells.length < 3) return;

    const rawDate = $(cells[0]).text().trim();
    const rawCity = $(cells[1]).text().trim();
    const titleCell = $(cells[2]);
    const titleLink = titleCell.find("a");
    const title = decodeHtmlEntities((titleLink.attr("title") || titleLink.text() || titleCell.text()).trim());
    const eventUrl = titleLink.attr("href") || "";

    if (!title) return;

    // Apply noise filter
    if (isNoiseTitle(title)) {
      console.log(`[gardaclick] Skipping noise title: "${title}"`);
      return;
    }

    // Apply non-sagra filter — we want ONLY food/sagra events
    if (isNonSagraTitle(title)) {
      console.log(`[gardaclick] Skipping non-sagra title: "${title}"`);
      return;
    }

    // Resolve city — only keep Veneto (VR province) towns
    const { city, isVeneto } = resolveVenetoCity(rawCity);
    if (!isVeneto) {
      console.log(`[gardaclick] Skipping non-Veneto city: "${rawCity}" — "${title}"`);
      return;
    }

    // Parse dates
    const { start: startDate, end: endDate } = parseDateCell(rawDate, currentMonth, year);

    // Apply past year filter
    if (containsPastYear(title, eventUrl)) {
      console.log(`[gardaclick] Skipping past year: "${title}"`);
      return;
    }

    // Skip past events
    if (startDate) {
      const eventEnd = endDate || startDate;
      if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
        console.log(`[gardaclick] Skipping past event: "${title}" (ends ${eventEnd})`);
        return;
      }
    }

    // Skip events without date
    if (!startDate) {
      console.log(`[gardaclick] Skipping "${title}" — no date`);
      return;
    }

    // Build source URL (prefer event's own URL, fall back to gardaclick page)
    const sourceUrl = eventUrl && eventUrl.startsWith("http")
      ? eventUrl
      : "https://www.gardaclick.com/eventi-fiere-mercati-lago-di-garda";

    // No images from the listing page — enrichment pipeline will add them
    const imageUrl: string | null = null;

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
      url: sourceUrl,
      sourceDescription: `${title} — ${city} (Lago di Garda)`,
      contentHash: generateContentHash(title, city, startDate),
      lat: null,
      lng: null,
    };

    events.push(event);
    console.log(`[gardaclick] Found: "${title}" — ${city} — ${startDate} to ${endDate}`);
  });

  return events;
}

// --- Detect year from page ---

function detectYear(html: string): number {
  // Try to find year in title: "stagione 2026"
  const yearMatch = html.match(/stagione\s+(\d{4})/i)
    || html.match(/calendario\s+(\d{4})/i)
    || html.match(/<title>[^<]*(\d{4})[^<]*<\/title>/i);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    if (year >= 2024 && year <= 2030) return year;
  }
  return new Date().getFullYear();
}

// --- Main scraping logic ---

const EVENTS_URL = "https://www.gardaclick.com/eventi-fiere-mercati-lago-di-garda";
const SOURCE_NAME = "gardaclick";

async function scrapeGardaclick(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  try {
    console.log(`[gardaclick] Fetching events page: ${EVENTS_URL}`);
    const html = await fetchWithTimeout(EVENTS_URL, 20_000);

    if (!html) {
      await logRun(supabase, "error", 0, 0, 0, "Failed to fetch events page", startedAt);
      console.error(`[gardaclick] Failed to fetch events page`);
      return;
    }

    const year = detectYear(html);
    console.log(`[gardaclick] Detected year: ${year}`);

    const events = parseEventsTable(html, year);
    totalFound = events.length;
    console.log(`[gardaclick] Found ${totalFound} Veneto food events`);

    // Upsert each event
    for (const event of events) {
      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[gardaclick] ${result}: "${event.title}" (${event.city})`);
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}`);
    console.log(`[gardaclick] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[gardaclick] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-gardaclick] Starting — scraping gardaclick.com Veneto events`);

  EdgeRuntime.waitUntil(scrapeGardaclick(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "gardaclick",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
