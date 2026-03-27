// =============================================================================
// scrape-arquapetrarca — Scrape events from arquapetrarca.com
// The official site of Arqua Petrarca (PD) lists events on a single WordPress
// page using Visual Composer text blocks. Each block contains an h6 date,
// h3 title, optional image, and paragraph description.
// All events are in Arqua Petrarca (PD) — province and city are fixed.
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
  // Whitelist: keep if clearly food/sagra related
  if (
    /\b(sagra|sagre|festa|feste|gastronomic|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia|giuggiole|olio|brodo)\b/i.test(t)
  ) {
    return false;
  }
  // Blacklist: skip non-food events
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

// --- Italian month name parser ---

const ITALIAN_MONTHS: Record<string, string> = {
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04",
  maggio: "05", giugno: "06", luglio: "07", agosto: "08",
  settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
};

/**
 * Parse Italian date strings like:
 * - "DOMENICA 22 FEBBRAIO 2026"
 * - "5 e 12 ottobre 2025"
 * - "4 ottobre 2025"
 * - "LUNEDì 8 Dicembre 2025"
 * Returns { startDate, endDate } in YYYY-MM-DD format, or nulls.
 */
function parseItalianDate(raw: string): { startDate: string | null; endDate: string | null } {
  if (!raw) return { startDate: null, endDate: null };

  const text = raw.trim().toLowerCase();

  // Try multi-day pattern: "5 e 12 ottobre 2025" or "5, 6 e 12 ottobre 2025"
  const multiMatch = text.match(
    /(\d{1,2})\s*(?:,\s*\d{1,2}\s*)*\s*e\s+(\d{1,2})\s+([a-zàèìòù]+)\s+(\d{4})/
  );
  if (multiMatch) {
    const day1 = multiMatch[1].padStart(2, "0");
    const day2 = multiMatch[2].padStart(2, "0");
    const month = ITALIAN_MONTHS[multiMatch[3]];
    const year = multiMatch[4];
    if (month) {
      return {
        startDate: `${year}-${month}-${day1}`,
        endDate: `${year}-${month}-${day2}`,
      };
    }
  }

  // Try range pattern: "dal 5 al 12 ottobre 2025" or "5-12 ottobre 2025"
  const rangeMatch = text.match(
    /(?:dal\s+)?(\d{1,2})\s*[-–]\s*(?:al\s+)?(\d{1,2})\s+([a-zàèìòù]+)\s+(\d{4})/
  );
  if (rangeMatch) {
    const day1 = rangeMatch[1].padStart(2, "0");
    const day2 = rangeMatch[2].padStart(2, "0");
    const month = ITALIAN_MONTHS[rangeMatch[3]];
    const year = rangeMatch[4];
    if (month) {
      return {
        startDate: `${year}-${month}-${day1}`,
        endDate: `${year}-${month}-${day2}`,
      };
    }
  }

  // Try cross-month range: "dal 28 settembre al 5 ottobre 2025"
  const crossMonthMatch = text.match(
    /(?:dal\s+)?(\d{1,2})\s+([a-zàèìòù]+)\s+(?:al\s+)?(\d{1,2})\s+([a-zàèìòù]+)\s+(\d{4})/
  );
  if (crossMonthMatch) {
    const day1 = crossMonthMatch[1].padStart(2, "0");
    const month1 = ITALIAN_MONTHS[crossMonthMatch[2]];
    const day2 = crossMonthMatch[3].padStart(2, "0");
    const month2 = ITALIAN_MONTHS[crossMonthMatch[4]];
    const year = crossMonthMatch[5];
    if (month1 && month2) {
      return {
        startDate: `${year}-${month1}-${day1}`,
        endDate: `${year}-${month2}-${day2}`,
      };
    }
  }

  // Single day: "22 FEBBRAIO 2026" or "DOMENICA 22 FEBBRAIO 2026"
  const singleMatch = text.match(/(\d{1,2})\s+([a-zàèìòù]+)\s+(\d{4})/);
  if (singleMatch) {
    const day = singleMatch[1].padStart(2, "0");
    const month = ITALIAN_MONTHS[singleMatch[2]];
    const year = singleMatch[3];
    if (month) {
      const date = `${year}-${month}-${day}`;
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
    console.error(`[arquapetrarca] Insert error: ${error.message}`);
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
    source_name:     "arquapetrarca",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Event page parser ---
// The events page is a single WP page with Visual Composer blocks.
// Each event block is a .wpb_text_column containing:
//   <h6> ARQUA' PETRARCA (location — always the same)
//   <h6> date string (Italian format)
//   <h5> "EVENTI" (category label — skip)
//   <h3> event title
//   <img> optional event poster/image
//   <p>  description paragraphs

interface RawEventBlock {
  title: string;
  dateText: string;
  imageUrl: string | null;
  description: string;
}

function parseEventsPage(html: string): RawEventBlock[] {
  const $ = cheerio.load(html);
  const events: RawEventBlock[] = [];

  // Each event is inside a .wpb_text_column > .wpb_wrapper
  $(".wpb_text_column .wpb_wrapper").each((_i: number, el: cheerio.Element) => {
    const wrapper = $(el);

    // Must have an h3 (event title)
    const h3 = wrapper.find("h3");
    if (h3.length === 0) return;

    const title = decodeHtmlEntities(h3.first().text().trim());
    if (!title) return;

    // Skip the main page "EVENTI" header (the section title, not an event)
    if (title === "EVENTI") return;

    // Extract date from h6 elements — the one that looks like a date (has digits)
    let dateText = "";
    wrapper.find("h6").each((_j: number, h6El: cheerio.Element) => {
      const text = $(h6El).text().trim();
      // The date h6 contains digits (day numbers)
      if (/\d/.test(text) && !dateText) {
        dateText = decodeHtmlEntities(text);
      }
    });

    // Extract first image
    let imageUrl: string | null = null;
    const img = wrapper.find("img").first();
    if (img.length > 0) {
      const src = img.attr("src") || "";
      // Skip logos, stemma, flags (data:image base64 inline)
      if (src && !isLowQualityUrl(src) && !src.includes("Stemma") && !src.startsWith("data:")) {
        imageUrl = src;
      }
    }

    // Extract description from paragraphs
    const descParts: string[] = [];
    wrapper.find("p").each((_j: number, pEl: cheerio.Element) => {
      const text = $(pEl).text().trim();
      if (text && text !== "\u00A0" && text.length > 2) {
        descParts.push(decodeHtmlEntities(text));
      }
    });
    const description = descParts.join("\n").trim();

    events.push({ title, dateText, imageUrl, description });
  });

  return events;
}

// --- Main scraping logic ---

const PAGE_URL = "https://www.arquapetrarca.com/eventi/";
const SOURCE_NAME = "arquapetrarca";
const CITY = "Arquà Petrarca";
const PROVINCE = "PD";

async function scrapeArquaPetrarca(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  try {
    console.log(`[arquapetrarca] Fetching events page: ${PAGE_URL}`);
    const html = await fetchWithTimeout(PAGE_URL, 20_000);

    if (!html) {
      console.error("[arquapetrarca] Failed to fetch events page");
      await logRun(supabase, "error", 0, 0, 0, "Failed to fetch events page", startedAt);
      return;
    }

    const rawEvents = parseEventsPage(html);
    console.log(`[arquapetrarca] Parsed ${rawEvents.length} raw event blocks`);

    for (const raw of rawEvents) {
      // Apply noise filter
      if (isNoiseTitle(raw.title)) {
        console.log(`[arquapetrarca] Skipping noise title: "${raw.title}"`);
        totalSkipped++;
        continue;
      }

      // Apply non-sagra filter
      if (isNonSagraTitle(raw.title)) {
        console.log(`[arquapetrarca] Skipping non-sagra title: "${raw.title}"`);
        totalSkipped++;
        continue;
      }

      // Parse Italian date
      const { startDate, endDate } = parseItalianDate(raw.dateText);

      // Apply past year filter
      if (containsPastYear(raw.title, PAGE_URL, raw.dateText + " " + raw.description)) {
        console.log(`[arquapetrarca] Skipping past year: "${raw.title}"`);
        totalSkipped++;
        continue;
      }

      // Skip events without any date
      if (!startDate) {
        console.log(`[arquapetrarca] Skipping "${raw.title}" — no date parsed from: "${raw.dateText}"`);
        totalSkipped++;
        continue;
      }

      // Skip past events
      const eventEnd = endDate || startDate;
      if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
        console.log(`[arquapetrarca] Skipping past event: "${raw.title}" (ends ${eventEnd})`);
        totalSkipped++;
        continue;
      }

      // Build description (max 2000 chars)
      let sourceDescription = raw.description || null;
      if (sourceDescription && sourceDescription.length > 2000) {
        sourceDescription = sourceDescription.slice(0, 2000);
      }
      if (sourceDescription && sourceDescription.length < 10) {
        sourceDescription = null;
      }

      const event: NormalizedEvent = {
        title: raw.title.slice(0, 200),
        normalizedTitle: normalizeText(raw.title),
        slug: generateSlug(raw.title, CITY),
        city: CITY,
        province: PROVINCE,
        startDate,
        endDate: endDate || startDate,
        priceInfo: null,
        isFree: null,
        imageUrl: raw.imageUrl,
        url: PAGE_URL,
        sourceDescription,
        contentHash: generateContentHash(raw.title, CITY, startDate),
      };

      totalFound++;
      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[arquapetrarca] ${result}: "${event.title}" (${startDate} → ${endDate || startDate})`);
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, raw_blocks=${rawEvents.length}`);
    console.log(`[arquapetrarca] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[arquapetrarca] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-arquapetrarca] Starting — scraping arquapetrarca.com events`);

  EdgeRuntime.waitUntil(scrapeArquaPetrarca(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "arquapetrarca",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
