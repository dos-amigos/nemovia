// =============================================================================
// scrape-trevisoeventi — Scrape sagre/feste from trevisoeventi.com
// Single static HTML page with all events in a table layout.
// Province is always TV (Treviso). No pagination needed.
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

// --- HTML entity decoder ---

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

// --- Noise / non-sagra filters ---

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

// --- Anti-Asian food filter on image URLs ---
const ASIAN_FOOD_REGEX = /\b(sushi|sashimi|ramen|noodle|chopstick|wok|dim[\s-]?sum|bao|gyoza|tempura|udon|soba|miso|tofu|teriyaki|wasabi|kimchi|bibimbap|pad[\s-]?thai|pho|spring[\s-]?roll|dumpling|asian|chinese|japanese|korean|thai|vietnamese|oriental|manga|anime|sakura|bamboo|lotus|dragon[\s-]?roll|nigiri|maki|onigiri)\b/i;

function isLowQualityUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  for (const pattern of BAD_IMAGE_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  // Anti-Asian food filter on image URL
  if (ASIAN_FOOD_REGEX.test(url)) return true;
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

// --- Italian month names to number ---

const ITALIAN_MONTHS: Record<string, string> = {
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04",
  maggio: "05", giugno: "06", luglio: "07", agosto: "08",
  settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
};

/**
 * Parse Italian date strings found on trevisoeventi.com.
 * Formats:
 *   "VENERDI 27 MARZO" (no year → assume current year)
 *   "VENERDI 27 MARZO 2026"
 *   "DA VENERDI 27 MARZO FINO A DOMENICA 12 APRILE 2026"
 *   "SABATO 28 MARZO 2026 ore 20.45"
 *   "SABATO 28 E DOMENICA 29 MARZO 2026"
 * Returns { startDate, endDate } in YYYY-MM-DD format.
 */
function parseItalianDateRange(text: string): { startDate: string | null; endDate: string | null } {
  const t = text.toUpperCase().trim();
  const currentYear = new Date().getFullYear();

  // Pattern: "DA ... dd MONTH ... FINO A ... dd MONTH YYYY"
  const rangeMatch = t.match(
    /DA\s+\w+\s+(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?\s+FINO\s+A\s+\w+\s+(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?/i
  );
  if (rangeMatch) {
    const startDay = rangeMatch[1].padStart(2, "0");
    const startMonthName = rangeMatch[2].toLowerCase();
    const startYear = rangeMatch[3] || rangeMatch[6] || String(currentYear);
    const endDay = rangeMatch[4].padStart(2, "0");
    const endMonthName = rangeMatch[5].toLowerCase();
    const endYear = rangeMatch[6] || startYear;
    const sm = ITALIAN_MONTHS[startMonthName];
    const em = ITALIAN_MONTHS[endMonthName];
    if (sm && em) {
      return {
        startDate: `${startYear}-${sm}-${startDay}`,
        endDate: `${endYear}-${em}-${endDay}`,
      };
    }
  }

  // Pattern: "dd E dd MONTH YYYY" (same month, two days)
  const twoDayMatch = t.match(
    /(\d{1,2})\s+E\s+(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?/i
  );
  if (twoDayMatch) {
    const day1 = twoDayMatch[1].padStart(2, "0");
    const day2 = twoDayMatch[2].padStart(2, "0");
    const monthName = twoDayMatch[3].toLowerCase();
    const year = twoDayMatch[4] || String(currentYear);
    const m = ITALIAN_MONTHS[monthName];
    if (m) {
      return {
        startDate: `${year}-${m}-${day1}`,
        endDate: `${year}-${m}-${day2}`,
      };
    }
  }

  // Pattern: single date "DAYNAME dd MONTH YYYY" or "dd MONTH YYYY" or "dd MONTH"
  const singleMatch = t.match(
    /(?:\w+\s+)?(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?/i
  );
  if (singleMatch) {
    const day = singleMatch[1].padStart(2, "0");
    const monthName = singleMatch[2].toLowerCase();
    const year = singleMatch[3] || String(currentYear);
    const m = ITALIAN_MONTHS[monthName];
    if (m) {
      const date = `${year}-${m}-${day}`;
      return { startDate: date, endDate: date };
    }
  }

  return { startDate: null, endDate: null };
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
    console.error(`[trevisoeventi] Insert error: ${error.message}`);
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
    source_name:     "trevisoeventi",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Parse the calendar page ---

/**
 * Extracts events from the trevisoeventi.com calendar page.
 * The page is a big table. Each event block is a <tr> containing:
 *   - Left <td>: dates (span.stampa-pdf), city (<strong>CITY (TV)</strong>),
 *     title (span.Titolo-middle > strong > a), description text
 *   - Right <td>: large image
 *
 * We parse each <tr> that contains a Titolo-middle link as an event.
 */
function parseCalendarPage(html: string): NormalizedEvent[] {
  const $ = cheerio.load(html);
  const events: NormalizedEvent[] = [];
  const seenSlugs = new Set<string>();
  const BASE = "https://www.trevisoeventi.com";

  // Find all <td> cells that contain event data (have Titolo-middle links)
  // Each event block is inside a <td class="Localita"> with a detail link
  $("td.Localita").each((_i: number, td: cheerio.Element) => {
    const $td = $(td);

    // Find title links: span.Titolo-middle > strong > a[href]
    const titleLinks = $td.find("span.Titolo-middle a[href]");
    if (titleLinks.length === 0) return;

    // Process each title link found in this cell (some cells have multiple events)
    titleLinks.each((_j: number, linkEl: cheerio.Element) => {
      const $link = $(linkEl);
      const href = $link.attr("href") || "";

      // Skip non-event links (contatti, mercati-settimanali, mercatini-antiquariato, etc.)
      if (!href.includes("trevisoeventi.com/") || href.includes("contatti") ||
          href.includes("mercati-settimanali") || href.includes("mercatini-antiquariato") ||
          href.includes("noleggio") || href.includes("inserire-") ||
          href.includes("iscrizione-") || href.includes("servizi-") ||
          href.includes("treviso-musei")) {
        return;
      }

      const rawTitle = decodeHtmlEntities($link.text().trim());
      if (!rawTitle) return;

      // Clean title: remove edition numbers like "77ª", "14ª", "53ª" at the start
      const title = rawTitle.replace(/^\d+[ªº°]\s*/, "").trim() || rawTitle;

      // Apply filters
      if (isNoiseTitle(title)) {
        console.log(`[trevisoeventi] Skipping noise: "${title}"`);
        return;
      }
      if (isNonSagraTitle(title)) {
        console.log(`[trevisoeventi] Skipping non-sagra: "${title}"`);
        return;
      }

      // Extract the full text content of the parent td to find dates and city
      const cellText = $td.text();

      // Extract city: look for pattern "CITY (TV)" or "CITY (PN)" etc.
      // We only want TV province events, but also accept nearby (PN, VE) that
      // trevisoeventi.com lists — we'll filter to TV only
      let city = "";
      let detectedProvince = "TV"; // default for this source

      // Pattern: STRONG text containing "CITYNAME (XX)"
      const cityStrongs = $td.find("strong");
      for (let k = 0; k < cityStrongs.length; k++) {
        const strongText = $(cityStrongs[k]).text().trim();
        const cityMatch = strongText.match(/^([A-ZÀÈÉÌÒÙ][A-ZÀÈÉÌÒÙ\s']+)\s*\(([A-Z]{2})\)\s*$/);
        if (cityMatch) {
          city = cityMatch[1].trim();
          detectedProvince = cityMatch[2];
          break;
        }
      }

      // If no city from strong tags, try regex on cell text
      if (!city) {
        const textCityMatch = cellText.match(/([A-ZÀÈÉÌÒÙ][A-ZÀÈÉÌÒÙ\s']+)\s*\(TV\)/);
        if (textCityMatch) {
          city = textCityMatch[1].trim();
        }
      }

      // Skip non-TV events (some events are from PN, VE, etc.)
      if (detectedProvince !== "TV") {
        console.log(`[trevisoeventi] Skipping non-TV: "${title}" (${detectedProvince})`);
        return;
      }

      if (!city) {
        console.log(`[trevisoeventi] Skipping "${title}" — no city found`);
        return;
      }

      // Capitalize city properly: "CASTELFRANCO VENETO" → "Castelfranco Veneto"
      city = city
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\bDi\b/g, "di")
        .replace(/\bDel\b/g, "del")
        .replace(/\bDella\b/g, "della")
        .replace(/\bDello\b/g, "dello")
        .replace(/\bDelle\b/g, "delle")
        .replace(/\bDegli\b/g, "degli")
        .replace(/\bDei\b/g, "dei");

      // Extract dates from span.stampa-pdf elements before this link
      let startDate: string | null = null;
      let endDate: string | null = null;

      // Get all stampa-pdf spans in the cell
      const dateSpans = $td.find("span.stampa-pdf");
      for (let k = 0; k < dateSpans.length; k++) {
        const dateText = $(dateSpans[k]).text().trim();
        if (!dateText) continue;

        // Try to parse date range or single date
        const parsed = parseItalianDateRange(dateText);
        if (parsed.startDate) {
          if (!startDate) {
            startDate = parsed.startDate;
            endDate = parsed.endDate;
          }
          // If we find a later end date, update it
          if (parsed.endDate && (!endDate || parsed.endDate > endDate)) {
            endDate = parsed.endDate;
          }
          break; // Use the first valid date found
        }
      }

      // Apply past year filter
      if (containsPastYear(title, href)) {
        console.log(`[trevisoeventi] Skipping past year: "${title}"`);
        return;
      }

      // Skip past events
      if (startDate) {
        const eventEnd = endDate || startDate;
        if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
          console.log(`[trevisoeventi] Skipping past event: "${title}" (ends ${eventEnd})`);
          return;
        }
      }

      // Skip events without any date
      if (!startDate) {
        console.log(`[trevisoeventi] Skipping "${title}" — no date found`);
        return;
      }

      // Build detail URL
      const detailUrl = href.startsWith("http") ? href : `${BASE}/${href.replace(/^\//, "")}`;

      // Extract image from the parent <tr> or sibling <td>
      let imageUrl: string | null = null;
      const parentTr = $td.closest("tr");
      if (parentTr.length) {
        // Look for large images in sibling td cells
        parentTr.find("td img").each((_k: number, img: cheerio.Element) => {
          if (imageUrl) return; // already found
          const src = $(img).attr("src") || "";
          const width = parseInt($(img).attr("width") || "0", 10);
          // Skip small images (logos, icons, buttons)
          if (width > 0 && width < 200) return;
          // Skip known non-event images
          if (src.includes("google-calendar") || src.includes("logo-treviso") ||
              src.includes("inserisci-evento") || src.includes("news.jpg") ||
              src.includes("programma.jpg") || src.includes("prenotazioni.jpg") ||
              src.includes("prenotazione-") || src.includes("infoline") ||
              src.includes("menu.jpg") || src.includes("banner/")) return;
          if (!isLowQualityUrl(src)) {
            imageUrl = src.startsWith("http") ? src : `${BASE}/${src.replace(/^\//, "")}`;
          }
        });
      }

      // Extract description: get text from the cell, clean it up
      let description: string | null = null;
      const rawText = $td.text()
        .replace(/\s+/g, " ")
        .trim();
      if (rawText.length > 30) {
        // Take a reasonable chunk of description, skip the first part (dates/city/title)
        description = rawText.slice(0, 2000).trim();
        if (description.length < 20) description = null;
      }

      // Check price info
      let priceInfo: string | null = null;
      let isFree: boolean | null = null;
      const lowerText = cellText.toLowerCase();
      if (/ingresso\s+(libero|gratuito)/i.test(lowerText) || /gratis/i.test(lowerText)) {
        isFree = true;
        priceInfo = "Ingresso gratuito";
      }

      // Generate slug and check for duplicates within this parse
      const slug = generateSlug(title, city);
      if (seenSlugs.has(slug)) return;
      seenSlugs.add(slug);

      events.push({
        title: title.slice(0, 200),
        normalizedTitle: normalizeText(title),
        slug,
        city,
        province: "TV",
        startDate,
        endDate: endDate || startDate,
        priceInfo,
        isFree,
        imageUrl,
        url: detailUrl,
        sourceDescription: description,
        contentHash: generateContentHash(title, city, startDate),
      });
    });
  });

  return events;
}

// --- Main scraping logic ---

const PAGE_URL = "https://www.trevisoeventi.com/calendario-eventi-treviso.htm";
const SOURCE_NAME = "trevisoeventi";

async function scrapeTrevisoEventi(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  try {
    console.log(`[trevisoeventi] Fetching calendar page: ${PAGE_URL}`);
    const html = await fetchWithTimeout(PAGE_URL, 20_000);

    if (!html) {
      console.error(`[trevisoeventi] Failed to fetch calendar page`);
      await logRun(supabase, "error", 0, 0, 0, "Failed to fetch calendar page", startedAt);
      return;
    }

    console.log(`[trevisoeventi] Page fetched, ${html.length} bytes`);

    const events = parseCalendarPage(html);
    totalFound = events.length;
    console.log(`[trevisoeventi] Parsed ${totalFound} sagra/festa events`);

    for (const event of events) {
      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[trevisoeventi] ${result}: "${event.title}" (${event.city}, ${event.startDate})`);
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}`);
    console.log(`[trevisoeventi] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[trevisoeventi] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-trevisoeventi] Starting — scraping trevisoeventi.com calendar`);

  EdgeRuntime.waitUntil(scrapeTrevisoEventi(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "trevisoeventi",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
