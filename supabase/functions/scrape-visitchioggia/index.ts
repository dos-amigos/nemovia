// =============================================================================
// scrape-visitchioggia — Scrape sagre from visitchioggia.com (official Chioggia tourism)
// Fetches the "feste e sagre" listing page, follows detail links, extracts
// event info from HTML (no JSON-LD available on this site).
// Province is always VE, city defaults to "Chioggia" unless extractable.
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
  // Whitelist: sagra/food-related terms
  if (
    /\b(sagra|sagre|festa|feste|gastronomic|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia)/i.test(t)
  ) {
    return false;
  }
  // Blacklist: non-sagra event types
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

const BASE_ORIGIN = "https://www.visitchioggia.com";

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

  // No GPS coords from this source → pending_geocode
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
    console.error(`[visitchioggia] Insert error: ${error.message}`);
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
    source_name:     "visitchioggia",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Listing page parser: extract detail page URLs ---

function extractDetailLinks(html: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];

  // visitchioggia listing has anchor tags linking to /it/eventi/feste-e-sagre/{slug}/
  $("a[href]").each((_i: number, el: cheerio.Element) => {
    const href = $(el).attr("href");
    if (!href) return;

    // Match detail page URLs under /it/eventi/feste-e-sagre/{slug}/
    // Exclude the listing page itself (no extra slug segment)
    if (/^\/it\/eventi\/feste-e-sagre\/[a-z0-9][a-z0-9\-]+\/?$/i.test(href)) {
      const fullUrl = `${BASE_ORIGIN}${href.replace(/\/$/, "")}/`;
      if (!links.includes(fullUrl)) links.push(fullUrl);
    }
  });

  return links;
}

// --- Date extraction from page text ---

const ITALIAN_MONTHS: Record<string, string> = {
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04",
  maggio: "05", giugno: "06", luglio: "07", agosto: "08",
  settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
  // abbreviated
  gen: "01", feb: "02", mar: "03", apr: "04",
  mag: "05", giu: "06", lug: "07", ago: "08",
  set: "09", ott: "10", nov: "11", dic: "12",
};

/**
 * Try to extract dates from the page text. visitchioggia uses various formats:
 * - "lug 10 2026" (sidebar date links)
 * - "10 luglio 2026" / "dal 10 al 20 luglio 2026"
 * - "terzo weekend di giugno" (vague — skip)
 * Returns { startDate, endDate } as YYYY-MM-DD or null.
 */
function extractDatesFromText(text: string): { startDate: string | null; endDate: string | null } {
  // Pattern 1: "lug 10 2026" or "ago 5 2026" (sidebar format)
  const sidebarPattern = /\b(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\s+(\d{1,2})\s+(20\d{2})\b/gi;
  const sidebarMatches: { date: string; pos: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = sidebarPattern.exec(text)) !== null) {
    const monthCode = ITALIAN_MONTHS[m[1].toLowerCase()];
    if (monthCode) {
      const day = m[2].padStart(2, "0");
      sidebarMatches.push({ date: `${m[3]}-${monthCode}-${day}`, pos: m.index });
    }
  }
  if (sidebarMatches.length > 0) {
    // Sort dates and return first + last
    const sorted = sidebarMatches.map(s => s.date).sort();
    return { startDate: sorted[0], endDate: sorted[sorted.length - 1] };
  }

  // Pattern 2: "10 luglio 2026" or "dal 10 al 20 luglio 2026"
  const fullDatePattern = /\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(20\d{2})\b/gi;
  const fullMatches: string[] = [];
  while ((m = fullDatePattern.exec(text)) !== null) {
    const monthCode = ITALIAN_MONTHS[m[2].toLowerCase()];
    if (monthCode) {
      const day = m[1].padStart(2, "0");
      fullMatches.push(`${m[3]}-${monthCode}-${day}`);
    }
  }
  if (fullMatches.length > 0) {
    const sorted = fullMatches.sort();
    return { startDate: sorted[0], endDate: sorted[sorted.length - 1] };
  }

  // Pattern 3: range "dal 10 al 20 luglio 2026" (same month)
  const rangePattern = /\bdal\s+(\d{1,2})\s+al\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(20\d{2})\b/i;
  const rangeMatch = text.match(rangePattern);
  if (rangeMatch) {
    const monthCode = ITALIAN_MONTHS[rangeMatch[3].toLowerCase()];
    if (monthCode) {
      const startDay = rangeMatch[1].padStart(2, "0");
      const endDay = rangeMatch[2].padStart(2, "0");
      return {
        startDate: `${rangeMatch[4]}-${monthCode}-${startDay}`,
        endDate: `${rangeMatch[4]}-${monthCode}-${endDay}`,
      };
    }
  }

  return { startDate: null, endDate: null };
}

// --- Detail page parser ---

function parseDetailPage(html: string, sourceUrl: string): NormalizedEvent | null {
  const $ = cheerio.load(html);

  // Extract title — try h1 first, then og:title
  let title = $("h1").first().text().trim();
  if (!title) title = $('meta[property="og:title"]').attr("content")?.trim() ?? "";
  if (!title) title = $("title").text().trim().split("|")[0].trim();
  title = decodeHtmlEntities(title);

  if (!title) return null;

  // Apply filters
  if (isNoiseTitle(title)) {
    console.log(`[visitchioggia] Skipping noise title: "${title}"`);
    return null;
  }
  if (isNonSagraTitle(title)) {
    console.log(`[visitchioggia] Skipping non-sagra title: "${title}"`);
    return null;
  }

  // Extract description — get the main content text
  let description: string | null = null;
  // Try main content area (SilverStripe CMS typical selectors)
  const contentSelectors = [
    ".content .typography",
    ".typography",
    "article",
    ".main-content",
    ".content",
    "#content",
  ];
  for (const sel of contentSelectors) {
    const el = $(sel).first();
    if (el.length > 0) {
      // Remove navigation, sidebar, footer elements
      const clone = el.clone();
      clone.find("nav, header, footer, .sidebar, .breadcrumb, script, style").remove();
      const text = clone.text().trim();
      if (text.length > 50) {
        description = decodeHtmlEntities(text.replace(/\s+/g, " ").trim());
        break;
      }
    }
  }

  // Fallback: concatenate all <p> tags in main area
  if (!description) {
    const paragraphs: string[] = [];
    $("p").each((_i: number, el: cheerio.Element) => {
      const t = $(el).text().trim();
      if (t.length > 20) paragraphs.push(t);
    });
    if (paragraphs.length > 0) {
      description = decodeHtmlEntities(paragraphs.join(" ").replace(/\s+/g, " ").trim());
    }
  }

  if (description && description.length > 2000) description = description.slice(0, 2000);
  if (description && description.length < 10) description = null;

  // Apply past year filter
  if (containsPastYear(title, sourceUrl, description ?? undefined)) {
    console.log(`[visitchioggia] Skipping past year: "${title}"`);
    return null;
  }

  // Extract dates from full page text (sidebar dates + body text)
  const fullPageText = $("body").text();
  const { startDate, endDate } = extractDatesFromText(fullPageText);

  // Skip past events
  if (startDate) {
    const eventEnd = endDate || startDate;
    if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
      console.log(`[visitchioggia] Skipping past event: "${title}" (ends ${eventEnd})`);
      return null;
    }
  }

  // Note: events without dates are allowed through (the enrichment pipeline
  // will set them to needs_review via the auto-approval gate)

  // City — always Chioggia area; try to detect Sottomarina from text
  let city = "Chioggia";
  const bodyText = fullPageText.toLowerCase();
  if (bodyText.includes("sottomarina") && !bodyText.includes("chioggia")) {
    city = "Sottomarina";
  }

  // Image — try og:image first, then first content image
  let imageUrl: string | null = null;
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && !isLowQualityUrl(ogImage)) {
    imageUrl = ogImage.startsWith("http") ? ogImage : `${BASE_ORIGIN}${ogImage}`;
  }
  if (!imageUrl) {
    // Try gallery images or content images
    const imgSelectors = [
      ".gallery img",
      ".content img",
      ".typography img",
      "article img",
      ".main-content img",
    ];
    for (const sel of imgSelectors) {
      const img = $(sel).first();
      const src = img.attr("src");
      if (src && !isLowQualityUrl(src)) {
        imageUrl = src.startsWith("http") ? src : `${BASE_ORIGIN}${src}`;
        break;
      }
    }
  }

  return {
    title: title.slice(0, 200),
    normalizedTitle: normalizeText(title),
    slug: generateSlug(title, city),
    city,
    province: "VE",
    startDate,
    endDate: endDate || startDate,
    priceInfo: null,
    isFree: null,
    imageUrl,
    url: sourceUrl,
    sourceDescription: description,
    contentHash: generateContentHash(title, city, startDate),
  };
}

// --- Main scraping logic ---

const LISTING_URL = "https://www.visitchioggia.com/it/eventi/feste-e-sagre/";
const SOURCE_NAME = "visitchioggia";
const DELAY_MS = 2000; // politeness delay (tourism site, be gentle)

async function scrapeVisitChioggia(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  try {
    // Phase 1: Fetch listing page and collect detail URLs
    console.log(`[visitchioggia] Fetching listing page: ${LISTING_URL}`);
    const listingHtml = await fetchWithTimeout(LISTING_URL, 15_000);
    if (!listingHtml) {
      console.error(`[visitchioggia] Failed to fetch listing page`);
      await logRun(supabase, "error", 0, 0, 0, "Failed to fetch listing page", startedAt);
      return;
    }

    const detailUrls = extractDetailLinks(listingHtml);
    console.log(`[visitchioggia] Found ${detailUrls.length} detail links`);

    if (detailUrls.length === 0) {
      console.log(`[visitchioggia] No detail links found — site may have changed structure`);
      await logRun(supabase, "success", 0, 0, 0, null, startedAt, "no_links_found");
      return;
    }

    // Phase 2: Fetch each detail page and parse
    for (const detailUrl of detailUrls) {
      // Time budget check (120s total)
      if (Date.now() - startedAt > 100_000) {
        console.log(`[visitchioggia] Time budget exceeded, stopping`);
        break;
      }

      console.log(`[visitchioggia] Fetching detail: ${detailUrl}`);
      const html = await fetchWithTimeout(detailUrl, 10_000);
      if (!html) {
        console.log(`[visitchioggia] Failed to fetch: ${detailUrl}`);
        continue;
      }

      const event = parseDetailPage(html, detailUrl);
      if (!event) continue;

      totalFound++;
      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[visitchioggia] ${result}: "${event.title}" (${event.city}, ${event.province}) dates=${event.startDate}..${event.endDate}`);

      // Politeness delay between detail pages
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, detail_urls=${detailUrls.length}`);
    console.log(`[visitchioggia] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[visitchioggia] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-visitchioggia] Starting — scraping visitchioggia.com feste e sagre`);

  EdgeRuntime.waitUntil(scrapeVisitChioggia(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "visitchioggia",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
