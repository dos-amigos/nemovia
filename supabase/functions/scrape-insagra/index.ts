// =============================================================================
// scrape-insagra — Scrape sagre from insagra.it (JSON-LD Event on detail pages)
// Fetches Veneto listing pages (paginated, ~5 pages), follows detail links,
// parses JSON-LD Event schema with GPS coordinates.
// GPS included → status starts at pending_llm (skip geocoding).
// =============================================================================

import * as cheerio from "npm:cheerio@1";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// --- Type definitions ---
interface NormalizedEvent {
  title: string;
  normalizedTitle: string;
  slug: string;
  city: string;
  province: string | null;
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

function isLowQualityUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  for (const pattern of BAD_IMAGE_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  return false;
}

// --- Province mapping ---

const PROVINCE_NAME_TO_CODE: Record<string, string> = {
  belluno: "BL", padova: "PD", rovigo: "RO", treviso: "TV",
  venezia: "VE", vicenza: "VI", verona: "VR",
  // abbreviations used in insagra URLs
  bl: "BL", pd: "PD", ro: "RO", tv: "TV",
  ve: "VE", vi: "VI", vr: "VR",
};

function resolveProvince(rawProvince: string | null | undefined): string | null {
  if (!rawProvince) return null;
  const key = rawProvince.trim().toLowerCase();
  return PROVINCE_NAME_TO_CODE[key] ?? null;
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

  // insagra provides GPS coords → skip geocoding, go straight to pending_llm
  const hasCoords = event.lat != null && event.lng != null;

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
    status:             hasCoords ? "pending_llm" : "pending_geocode",
    content_hash:       event.contentHash,
  };

  if (hasCoords) {
    insertData.location = `SRID=4326;POINT(${event.lng} ${event.lat})`;
  }

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
    console.error(`[insagra] Insert error: ${error.message}`);
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
    source_name:     "insagra",
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

  // insagra listing pages have event cards linking to detail pages
  // URL pattern: /veneto/{province}/{city}/{slug}/
  $("a[href]").each((_i: number, el: cheerio.Element) => {
    const href = $(el).attr("href");
    if (!href) return;
    // Match detail page URLs: /veneto/{province}/{city}/{slug}/
    if (/^https?:\/\/insagra\.it\/veneto\/[^/]+\/[^/]+\/[^/]+\/?$/.test(href)) {
      if (!links.includes(href)) links.push(href);
    }
  });

  return links;
}

// --- Detail page parser: extract Event JSON-LD ---

function parseDetailPage(html: string, sourceUrl: string): NormalizedEvent | null {
  const $ = cheerio.load(html);

  // Find Event JSON-LD
  let eventData: Record<string, unknown> | null = null;

  $('script[type="application/ld+json"]').each((_i: number, el: cheerio.Element) => {
    try {
      const jsonData = JSON.parse($(el).text().trim());

      // Direct Event type
      if (jsonData["@type"] === "Event") {
        eventData = jsonData;
        return false; // break
      }

      // Nested in @graph array
      if (jsonData["@graph"] && Array.isArray(jsonData["@graph"])) {
        for (const item of jsonData["@graph"]) {
          if (item["@type"] === "Event") {
            eventData = item;
            return false;
          }
        }
      }
    } catch {
      // JSON parse error — skip
    }
  });

  if (!eventData) return null;

  // Extract title
  const title = decodeHtmlEntities(String(eventData.name || "").trim());
  if (!title) return null;

  // Apply filters
  if (isNoiseTitle(title)) {
    console.log(`[insagra] Skipping noise title: "${title}"`);
    return null;
  }
  if (isNonSagraTitle(title)) {
    console.log(`[insagra] Skipping non-sagra title: "${title}"`);
    return null;
  }

  // Extract dates (YYYY-MM-DD)
  let startDate: string | null = null;
  let endDate: string | null = null;
  if (eventData.startDate) startDate = String(eventData.startDate).slice(0, 10);
  if (eventData.endDate) endDate = String(eventData.endDate).slice(0, 10);

  // Extract description from JSON-LD
  let description: string | null = null;
  if (eventData.description) {
    description = decodeHtmlEntities(String(eventData.description).trim());
    // Clean up whitespace
    description = description.replace(/\s+/g, " ").trim();
    if (description.length > 2000) description = description.slice(0, 2000);
    if (description.length < 10) description = null;
  }

  // Also try to get richer description from HTML body (JSON-LD description is often truncated)
  const descSection = $("h3:contains('Descrizione')").next();
  if (descSection.length > 0) {
    const htmlDesc = descSection.text().trim();
    if (htmlDesc && htmlDesc.length > (description?.length ?? 0)) {
      description = decodeHtmlEntities(htmlDesc.replace(/\s+/g, " ").trim());
      if (description.length > 2000) description = description.slice(0, 2000);
    }
  }

  // Apply past year filter
  if (containsPastYear(title, sourceUrl, description ?? undefined)) {
    console.log(`[insagra] Skipping past year: "${title}"`);
    return null;
  }

  // Skip past events
  if (startDate) {
    const eventEnd = endDate || startDate;
    if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
      console.log(`[insagra] Skipping past event: "${title}" (ends ${eventEnd})`);
      return null;
    }
  }

  // Skip events without any date
  if (!startDate) {
    console.log(`[insagra] Skipping "${title}" — no date available`);
    return null;
  }

  // Extract location
  const location = eventData.location as Record<string, unknown> | undefined;
  let city = "";
  let provinceRaw: string | null = null;

  if (location) {
    const address = location.address as Record<string, unknown> | undefined;
    if (address) {
      city = String(address.addressLocality || "").trim();
      // addressRegion on insagra is always "Veneto", not useful for province
    }
    if (!city) city = String(location.name || "").split(",")[0].trim();
  }

  // Extract province from URL: /veneto/{province}/{city}/{slug}/
  const urlMatch = sourceUrl.match(/insagra\.it\/veneto\/([^/]+)\//);
  if (urlMatch) {
    provinceRaw = urlMatch[1];
  }

  const province = resolveProvince(provinceRaw);

  if (!city) city = provinceRaw ?? "";
  city = decodeHtmlEntities(city);

  // Validate region — insagra listing is Veneto-only but double-check
  if (!province) {
    console.log(`[insagra] Skipping "${title}" — cannot resolve province from URL: ${sourceUrl}`);
    return null;
  }

  // Extract GPS coordinates
  let lat: number | null = null;
  let lng: number | null = null;
  const geo = (location?.geo as Record<string, unknown>) ?? null;
  if (geo) {
    lat = typeof geo.latitude === "number" ? geo.latitude : parseFloat(String(geo.latitude));
    lng = typeof geo.longitude === "number" ? geo.longitude : parseFloat(String(geo.longitude));
    if (isNaN(lat) || isNaN(lng)) { lat = null; lng = null; }
    // Validate Veneto bounding box (roughly lat 44.8-46.7, lng 10.6-13.1)
    if (lat != null && lng != null) {
      if (lat < 44.5 || lat > 47.0 || lng < 10.0 || lng > 13.5) {
        console.log(`[insagra] Coords outside Veneto for "${title}": ${lat}, ${lng} — clearing`);
        lat = null;
        lng = null;
      }
    }
  }

  // Extract image from page (not in JSON-LD for insagra)
  let imageUrl: string | null = null;
  // Try og:image meta tag
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && !isLowQualityUrl(ogImage)) {
    imageUrl = ogImage;
  }
  // Try first content image if no og:image
  if (!imageUrl) {
    const contentImg = $(".entry-content img, article img, .post-content img").first().attr("src");
    if (contentImg && !isLowQualityUrl(contentImg)) {
      imageUrl = contentImg.startsWith("http") ? contentImg : `https://insagra.it${contentImg}`;
    }
  }

  // Price info
  const offers = eventData.offers as Record<string, unknown> | undefined;
  let priceInfo: string | null = null;
  let isFree: boolean | null = null;
  if (offers) {
    const price = String(offers.price || "");
    if (price === "0" || price === "0.00") {
      isFree = true;
      priceInfo = "Ingresso gratuito";
    } else if (price && price !== "Non specificato") {
      priceInfo = price;
    }
  }

  return {
    title: title.slice(0, 200),
    normalizedTitle: normalizeText(title),
    slug: generateSlug(title, city),
    city,
    province,
    startDate,
    endDate: endDate || startDate,
    priceInfo,
    isFree,
    imageUrl,
    url: sourceUrl,
    sourceDescription: description,
    contentHash: generateContentHash(title, city, startDate),
    lat,
    lng,
  };
}

// --- Main scraping logic ---

const BASE_URL = "https://insagra.it/regione/veneto/";
const MAX_PAGES = 6; // insagra has ~5 pages, add 1 safety margin
const SOURCE_NAME = "insagra";
const DELAY_MS = 1500; // politeness delay

async function scrapeInsagra(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  try {
    // Phase 1: Collect all detail page URLs from listing pages
    const allDetailUrls: string[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? BASE_URL : `${BASE_URL}page/${page}/`;
      console.log(`[insagra] Fetching listing page ${page}: ${url}`);

      const html = await fetchWithTimeout(url, 15_000);
      if (!html) {
        console.log(`[insagra] No HTML for page ${page}, stopping pagination`);
        break;
      }

      const links = extractDetailLinks(html);
      console.log(`[insagra] Page ${page}: found ${links.length} detail links`);

      if (links.length === 0) {
        // No more events — end of pagination
        break;
      }

      for (const link of links) {
        if (!allDetailUrls.includes(link)) allDetailUrls.push(link);
      }

      // Politeness delay between listing pages
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    console.log(`[insagra] Total unique detail URLs: ${allDetailUrls.length}`);

    // Phase 2: Fetch each detail page and parse JSON-LD Event
    for (const detailUrl of allDetailUrls) {
      // Time budget check (120s total)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[insagra] Time budget exceeded, stopping`);
        break;
      }

      console.log(`[insagra] Fetching detail: ${detailUrl}`);
      const html = await fetchWithTimeout(detailUrl, 10_000);
      if (!html) {
        console.log(`[insagra] Failed to fetch: ${detailUrl}`);
        continue;
      }

      const event = parseDetailPage(html, detailUrl);
      if (!event) continue;

      totalFound++;
      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[insagra] ${result}: "${event.title}" (${event.city}, ${event.province})`);

      // Politeness delay between detail pages
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, detail_urls=${allDetailUrls.length}`);
    console.log(`[insagra] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[insagra] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-insagra] Starting — scraping insagra.it Veneto listings`);

  EdgeRuntime.waitUntil(scrapeInsagra(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "insagra",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
