import * as cheerio from "npm:cheerio@1";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// --- Type definitions (mirrored from src/lib/scraper/types.ts) ---
interface ScraperSource {
  id: string;
  name: string;
  display_name: string;
  base_url: string;
  selector_item: string;
  selector_title: string;
  selector_start_date: string | null;
  selector_end_date: string | null;
  selector_city: string | null;
  selector_price: string | null;
  selector_url: string | null;
  selector_image: string | null;
  url_pattern: string | null;
  next_page_selector: string | null;
  max_pages: number;
  is_active: boolean;
  consecutive_failures: number;
}

interface NormalizedEvent {
  title: string;
  normalizedTitle: string;
  slug: string;
  city: string;
  startDate: string | null;
  endDate: string | null;
  priceInfo: string | null;
  isFree: boolean | null;
  imageUrl: string | null;
  url: string | null;
  contentHash: string;
}

interface DuplicateResult {
  id: string;
  image_url: string | null;
  price_info: string | null;
  is_free: boolean | null;
  sources: string[];
}

// --- Section 2: Helper functions (mirrored from src/lib/scraper/normalize.ts and date-parser.ts) ---
// JS port of PostgreSQL normalize_text() — must produce equivalent output for dedup to work.
// SQL: lower(regexp_replace(unaccent(t), '[^a-z0-9\s]', '', 'g'))

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

// Simple 12-char hex hash using djb2-style algorithm (no crypto dependency)
function generateContentHash(title: string, city: string, startDate: string | null): string {
  const input = `${normalizeText(title)}|${normalizeText(city)}|${startDate ?? ""}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    hash = hash >>> 0; // keep as unsigned 32-bit
  }
  // Combine two hash passes for 12 chars
  let hash2 = 0;
  for (let i = input.length - 1; i >= 0; i--) {
    hash2 = ((hash2 << 5) + hash2) ^ input.charCodeAt(i);
    hash2 = hash2 >>> 0;
  }
  return (hash.toString(16).padStart(8, "0") + hash2.toString(16).padStart(8, "0")).slice(0, 12);
}

const ITALIAN_MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6,
  lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
};

function toIso(day: number, month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseItalianDateRange(raw: string): { start: string | null; end: string | null } {
  if (!raw) return { start: null, end: null };
  const s = raw.toLowerCase().trim();

  // Pattern 1: DD/MM/YYYY [al DD/MM/YYYY]
  // Handles: "24/04/2026 al 26/04/2026", "Dal 08/03/2026 Al 08/03/2026", "Il 08/03/2026"
  const slashMatch = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:.*?(\d{1,2})\/(\d{1,2})\/(\d{4}))?/);
  if (slashMatch) {
    const start = toIso(+slashMatch[1], +slashMatch[2], +slashMatch[3]);
    const end = slashMatch[4]
      ? toIso(+slashMatch[4], +slashMatch[5], +slashMatch[6])
      : start;
    return { start, end };
  }

  // Pattern 2: DD[-DD] MonthName YYYY (e.g. "24 Aprile 2026", "24-26 Aprile 2026")
  const wordMatch = s.match(/(\d{1,2})(?:-(\d{1,2}))?\s+([a-z]+)\s+(\d{4})/);
  if (wordMatch) {
    const monthNum = ITALIAN_MONTHS[wordMatch[3]];
    if (monthNum) {
      const startDay = +wordMatch[1];
      const endDay = wordMatch[2] ? +wordMatch[2] : startDay;
      const year = +wordMatch[4];
      return {
        start: toIso(startDay, monthNum, year),
        end: toIso(endDay, monthNum, year),
      };
    }
  }

  return { start: null, end: null };
}

// --- Section 3: HTTP fetch helper ---
async function fetchWithTimeout(url: string, timeoutMs = 10_000): Promise<string | null> {
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

// --- Section 4: Scraping logic ---
function buildPageUrl(source: ScraperSource, page: number): string {
  if (page === 1) return source.base_url;
  if (source.url_pattern) {
    return source.base_url + source.url_pattern.replace("{n}", String(page));
  }
  return source.base_url;
}

interface RawEventData {
  title: string;
  dateText: string;
  city: string;
  price: string | null;
  url: string | null;
  image: string | null;
}

// deno-lint-ignore no-explicit-any
function extractRawEvent($: any, el: any, source: ScraperSource): RawEventData {
  const $el = $(el);
  const title = $el.find(source.selector_title).first().text().trim();
  const dateText = source.selector_start_date
    ? $el.find(source.selector_start_date).first().text().trim()
    : $el.text().trim();
  const city = source.selector_city
    ? $el.find(source.selector_city).first().text().trim()
    : "";
  const price = source.selector_price
    ? $el.find(source.selector_price).first().text().trim() || null
    : null;

  let url: string | null = null;
  if (source.selector_url === null && $el.is("a")) {
    url = $el.attr("href") ?? null;
  } else if (source.selector_url) {
    url = $el.find(source.selector_url).first().attr("href") ?? null;
  }

  const image = source.selector_image
    ? $el.find(source.selector_image).first().attr("src") ?? null
    : null;

  return { title, dateText, city, price, url, image };
}

function normalizeRawEvent(raw: RawEventData, _sourceName: string): NormalizedEvent {
  const parsedDates = parseItalianDateRange(raw.dateText);
  const title = raw.title.slice(0, 200);
  const isFree = raw.price
    ? raw.price.toLowerCase().includes("grat") ||
      raw.price === "0" ||
      raw.price.toLowerCase() === "ingresso libero"
    : null;

  return {
    title,
    normalizedTitle: normalizeText(raw.title),
    slug: generateSlug(raw.title, raw.city),
    city: raw.city.trim(),
    startDate: parsedDates.start,
    endDate: parsedDates.end,
    priceInfo: raw.price,
    isFree,
    imageUrl: raw.image,
    url: raw.url,
    contentHash: generateContentHash(raw.title, raw.city, parsedDates.start),
  };
}

async function upsertEvent(
  supabase: SupabaseClient,
  event: NormalizedEvent,
  sourceName: string
): Promise<"inserted" | "merged" | "skipped"> {
  // 1. Find duplicate
  const { data: dupes } = await supabase.rpc("find_duplicate_sagra", {
    p_normalized_title: event.normalizedTitle,
    p_city: event.city.toLowerCase(),
    p_start_date: event.startDate,
    p_end_date: event.endDate,
  });

  const existing = (dupes as DuplicateResult[] | null)?.[0];

  if (existing) {
    // Already tracked by this source — skip
    if (existing.sources?.includes(sourceName)) return "skipped";

    // Enrich missing fields + add provenance
    await supabase.from("sagre").update({
      image_url:  existing.image_url  ?? event.imageUrl,
      price_info: existing.price_info ?? event.priceInfo,
      is_free:    existing.is_free    ?? event.isFree,
      sources:    [...(existing.sources ?? []), sourceName],
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
    return "merged";
  }

  // Insert new record
  const { error } = await supabase.from("sagre").insert({
    title:         event.title,
    slug:          event.slug,
    location_text: event.city,
    start_date:    event.startDate,
    end_date:      event.endDate,
    image_url:     event.imageUrl,
    source_url:    event.url,
    price_info:    event.priceInfo,
    is_free:       event.isFree,
    sources:       [sourceName],
    is_active:     true,
    status:        "pending_geocode",
    content_hash:  event.contentHash,
  });

  if (error) {
    // Slug conflict: regenerate with timestamp suffix
    if (error.code === "23505") {
      await supabase.from("sagre").insert({
        title:         event.title,
        slug:          event.slug + "-" + Date.now().toString(36),
        location_text: event.city,
        start_date:    event.startDate,
        end_date:      event.endDate,
        image_url:     event.imageUrl,
        source_url:    event.url,
        price_info:    event.priceInfo,
        is_free:       event.isFree,
        sources:       [sourceName],
        is_active:     true,
        status:        "pending_geocode",
        content_hash:  event.contentHash + Date.now().toString(36),
      });
    }
  }
  return "inserted";
}

async function logRun(
  supabase: SupabaseClient,
  source: ScraperSource,
  status: "success" | "error" | "skipped",
  eventsFound: number,
  eventsInserted: number,
  eventsMerged: number,
  errorMessage: string | null,
  startedAt: number
) {
  await supabase.from("scrape_logs").insert({
    source_id:       source.id,
    source_name:     source.name,
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

async function scrapeSource(supabase: SupabaseClient, source: ScraperSource): Promise<void> {
  const startedAt = Date.now();
  let eventsFound = 0;
  let eventsInserted = 0;
  let eventsMerged = 0;

  try {
    for (let page = 1; page <= source.max_pages; page++) {
      const url = buildPageUrl(source, page);
      const html = await fetchWithTimeout(url);

      if (html === null) {
        // Network error or non-OK response — stop pagination
        break;
      }

      const $ = cheerio.load(html);
      const items = $(source.selector_item);

      if (items.length === 0) {
        // Past last page
        break;
      }

      for (let i = 0; i < items.length; i++) {
        const raw = extractRawEvent($, items[i], source);

        // Skip items with no title or city
        if (!raw.title || !raw.city) continue;

        const normalized = normalizeRawEvent(raw, source.name);
        const result = await upsertEvent(supabase, normalized, source.name);

        eventsFound++;
        if (result === "inserted") eventsInserted++;
        else if (result === "merged") eventsMerged++;
      }

      // Politeness delay between pages
      if (page < source.max_pages) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // Log success
    await logRun(supabase, source, "success", eventsFound, eventsInserted, eventsMerged, null, startedAt);

    // Reset failure counter and update last_scraped_at
    await supabase.from("scraper_sources").update({
      consecutive_failures: 0,
      last_scraped_at: new Date().toISOString(),
    }).eq("id", source.id);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[scrapeSource] Error scraping ${source.name}:`, errorMessage);

    // Log error
    await logRun(supabase, source, "error", eventsFound, eventsInserted, eventsMerged, errorMessage, startedAt);

    // Increment consecutive failures; disable after 3
    const newFailures = source.consecutive_failures + 1;
    await supabase.from("scraper_sources").update({
      consecutive_failures: newFailures,
      last_scraped_at: new Date().toISOString(),
      ...(newFailures >= 3 ? { is_active: false } : {}),
    }).eq("id", source.id);
  }
}

// --- Section 5: Entry point ---
async function runPipeline(supabase: SupabaseClient) {
  const { data: sources, error } = await supabase
    .from("scraper_sources")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error || !sources?.length) {
    console.error("Failed to load sources:", error?.message);
    return;
  }

  for (const source of sources) {
    await scrapeSource(supabase, source as ScraperSource);
  }
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fire-and-forget: return 200 immediately, work continues in background
  EdgeRuntime.waitUntil(runPipeline(supabase));

  return new Response(
    JSON.stringify({ status: "started", timestamp: new Date().toISOString() }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
