// =============================================================================
// scrape-4jesoloevents — Scrape events from 4jesoloevents.it (Jesolo/Venezia)
// Fetches homepage listing with schema.org/Event microdata in hidden divs,
// then fetches detail pages for richer descriptions + GPS coordinates.
// All events are Jesolo (VE). Province is always "VE".
// GPS included from detail pages → status starts at pending_llm (skip geocoding).
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
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "\u2026")
    .replace(/&#039;/g, "'");
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
  // Whitelist: food/sagra-related terms pass through
  if (
    /\b(sagra|sagre|festa|feste|gastronomic|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia)/i.test(t)
  ) {
    return false;
  }
  // Blacklist: non-food events
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
    /\b(trofeo|torneo|campionato|coppa)\b/i.test(t) ||
    /\b(musical|danza|balletto)\b/i.test(t) ||
    /\b(ginnastica|atletica|nuoto|calcio|rugby|basket|pallavolo)\b/i.test(t)
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

// --- Anti-Asian food filter (RULE: no oriental food images EVER) ---

const ASIAN_FOOD_REGEX = /\b(sushi|sashimi|ramen|noodle|wok|dim[\s-]?sum|bao|gyoza|tempura|udon|soba|miso|tofu|teriyaki|wasabi|sake|chopstick|bacchett[eai]|asian|orientale|cinese|giapponese|chinese|japanese|korean|thai|vietnamese|pad[\s-]?thai|curry|tandoori|naan|samosa|spring[\s-]?roll|dumpling|pho|bibimbap|kimchi|satay|szechuan|cantonese|mandarin|peking|bangkok|tokyo|beijing)\b/i;

function isAsianFoodImage(url: string | null | undefined): boolean {
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
  if (isAsianFoodImage(url)) return true;
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

  // If GPS coords available → skip geocoding, go to pending_llm
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
    console.error(`[4jesoloevents] Insert error: ${error.message}`);
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
    source_name:     "4jesoloevents",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Listing page parser: extract events from homepage microdata ---

interface ListingEvent {
  title: string;
  startDate: string | null;
  endDate: string | null;
  city: string;
  streetAddress: string | null;
  description: string | null;
  imageUrl: string | null;
  detailUrl: string | null;
}

function extractListingEvents(html: string): ListingEvent[] {
  const $ = cheerio.load(html);
  const events: ListingEvent[] = [];

  // Each event card is in a div.views-row containing a hidden div with schema.org/Event microdata
  $("div.views-row").each((_i: number, row: cheerio.Element) => {
    const $row = $(row);

    // Extract title from listing link
    const titleEl = $row.find("div.lista-evento-nome a");
    const title = decodeHtmlEntities(titleEl.text().trim());
    if (!title) return;

    // Extract detail page URL
    let detailUrl: string | null = titleEl.attr("href") || null;
    if (detailUrl && !detailUrl.startsWith("http")) {
      detailUrl = `https://4jesoloevents.it${detailUrl}`;
    }

    // Extract dates from schema.org microdata in hidden div
    const hiddenDiv = $row.find('div.hidden[itemscope]');
    let startDate: string | null = null;
    let endDate: string | null = null;

    const startTimeEl = hiddenDiv.find('time[itemprop="startDate"]');
    const endTimeEl = hiddenDiv.find('time[itemprop="endDate"]');
    if (startTimeEl.length) {
      const dt = startTimeEl.attr("datetime") || startTimeEl.text();
      startDate = dt ? dt.trim().slice(0, 10) : null;
    }
    if (endTimeEl.length) {
      const dt = endTimeEl.attr("datetime") || endTimeEl.text();
      endDate = dt ? dt.trim().slice(0, 10) : null;
    }

    // Extract city from microdata
    const city = decodeHtmlEntities(
      hiddenDiv.find('span[itemprop="addressLocality"]').text().trim() || "Jesolo"
    );

    // Extract street address
    const streetAddress = decodeHtmlEntities(
      hiddenDiv.find('span[itemprop="streetAddress"]').text().trim() || ""
    ) || null;

    // Extract description from listing card
    const description = decodeHtmlEntities(
      $row.find("div.lista-evento-descrizione-interno").text().trim()
    ) || null;

    // Extract image URL from listing card
    let imageUrl: string | null = null;
    const imgEl = $row.find("div.lista-evento-foto img");
    if (imgEl.length) {
      imageUrl = imgEl.attr("src") || null;
    }

    events.push({
      title,
      startDate,
      endDate,
      city,
      streetAddress,
      description,
      imageUrl,
      detailUrl,
    });
  });

  return events;
}

// --- Detail page parser: extract richer description + GPS ---

interface DetailPageData {
  description: string | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
}

function parseDetailPage(html: string): DetailPageData {
  const $ = cheerio.load(html);

  // Extract rich description from detail page
  let description: string | null = null;

  // Try itemprop="description" in hidden div (richest source)
  const descEl = $('span[itemprop="description"]');
  if (descEl.length) {
    // Get HTML content and convert <p> tags to newlines for proper formatting
    const descHtml = descEl.html() || "";
    const descText = descHtml
      .replace(/<\/p>\s*<p>/g, "\n\n")
      .replace(/<\/?p>/g, "")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (descText.length > 10) {
      description = decodeHtmlEntities(descText);
      if (description.length > 2000) description = description.slice(0, 2000);
    }
  }

  // Fallback: try the visible description section
  if (!description) {
    const visibleDesc = $("div.dettaglio-evento-descrizione-interno");
    if (visibleDesc.length) {
      const descHtml = visibleDesc.html() || "";
      const descText = descHtml
        .replace(/<\/p>\s*<p>/g, "\n\n")
        .replace(/<\/?p>/g, "")
        .replace(/<br\s*\/?>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .trim();
      if (descText.length > 10) {
        description = decodeHtmlEntities(descText);
        if (description.length > 2000) description = description.slice(0, 2000);
      }
    }
  }

  // Extract GPS coordinates from Google Maps link
  // Pattern: maps.google.it/maps?f=d&hl=it&saddr=&daddr=45.536168,12.642933
  let lat: number | null = null;
  let lng: number | null = null;

  const mapsLink = $('a[href*="maps.google"]').attr("href") || "";
  const coordsMatch = mapsLink.match(/daddr=([\d.]+),([\d.]+)/);
  if (coordsMatch) {
    lat = parseFloat(coordsMatch[1]);
    lng = parseFloat(coordsMatch[2]);
    if (isNaN(lat) || isNaN(lng)) { lat = null; lng = null; }
    // Validate Veneto bounding box (roughly lat 44.8-46.7, lng 10.6-13.1)
    if (lat != null && lng != null) {
      if (lat < 44.5 || lat > 47.0 || lng < 10.0 || lng > 13.5) {
        console.log(`[4jesoloevents] Coords outside Veneto: ${lat}, ${lng} - clearing`);
        lat = null;
        lng = null;
      }
    }
  }

  // Also try extracting from Drupal.settings gmap markers (in script tags)
  if (lat == null || lng == null) {
    const scripts = $("script").toArray();
    for (const script of scripts) {
      const text = $(script).text();
      const markerMatch = text.match(/"latitude":([\d.]+)[^}]*"longitude":([\d.]+)/);
      if (markerMatch) {
        const parsedLat = parseFloat(markerMatch[1]);
        const parsedLng = parseFloat(markerMatch[2]);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          if (parsedLat >= 44.5 && parsedLat <= 47.0 && parsedLng >= 10.0 && parsedLng <= 13.5) {
            lat = parsedLat;
            lng = parsedLng;
            break;
          }
        }
      }
    }
  }

  // Extract image from detail page (larger version than listing thumbnail)
  let imageUrl: string | null = null;
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && !isLowQualityUrl(ogImage)) {
    imageUrl = ogImage;
  }

  return { description, lat, lng, imageUrl };
}

// --- Main scraping logic ---

const BASE_URL = "https://4jesoloevents.it/";
const SOURCE_NAME = "4jesoloevents";
const DELAY_MS = 1500; // politeness delay

async function scrape4JesoloEvents(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  let totalFiltered = 0;

  try {
    // Phase 1: Fetch homepage and extract all event listings
    console.log(`[4jesoloevents] Fetching homepage: ${BASE_URL}`);
    const html = await fetchWithTimeout(BASE_URL, 20_000);
    if (!html) {
      throw new Error("Failed to fetch homepage");
    }

    const listingEvents = extractListingEvents(html);
    console.log(`[4jesoloevents] Found ${listingEvents.length} events on homepage`);

    // Phase 2: Process each event — fetch detail page for richer data
    for (const listing of listingEvents) {
      // Time budget check (120s total)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[4jesoloevents] Time budget exceeded, stopping`);
        break;
      }

      const title = listing.title.slice(0, 200);

      // Apply filters
      if (isNoiseTitle(title)) {
        console.log(`[4jesoloevents] Skipping noise title: "${title}"`);
        totalFiltered++;
        continue;
      }
      if (isNonSagraTitle(title)) {
        console.log(`[4jesoloevents] Skipping non-sagra title: "${title}"`);
        totalFiltered++;
        continue;
      }

      // Skip events without any date
      if (!listing.startDate) {
        console.log(`[4jesoloevents] Skipping "${title}" - no date available`);
        totalFiltered++;
        continue;
      }

      // Skip past events
      const eventEnd = listing.endDate || listing.startDate;
      if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
        console.log(`[4jesoloevents] Skipping past event: "${title}" (ends ${eventEnd})`);
        totalFiltered++;
        continue;
      }

      // Apply past year filter
      if (containsPastYear(title, listing.detailUrl ?? undefined, listing.description ?? undefined)) {
        console.log(`[4jesoloevents] Skipping past year: "${title}"`);
        totalFiltered++;
        continue;
      }

      // Fetch detail page for richer description + GPS
      let detailData: DetailPageData = { description: null, lat: null, lng: null, imageUrl: null };
      if (listing.detailUrl) {
        console.log(`[4jesoloevents] Fetching detail: ${listing.detailUrl}`);
        const detailHtml = await fetchWithTimeout(listing.detailUrl, 10_000);
        if (detailHtml) {
          detailData = parseDetailPage(detailHtml);
        }
        // Politeness delay between detail pages
        await new Promise(r => setTimeout(r, DELAY_MS));
      }

      // Use detail page description if richer, otherwise listing description
      let description = detailData.description ?? listing.description;
      if (description) {
        description = description.replace(/\s+/g, " ").trim();
        if (description.length > 2000) description = description.slice(0, 2000);
        if (description.length < 10) description = null;
      }

      // Image: prefer detail page image, then listing image
      let imageUrl = detailData.imageUrl ?? listing.imageUrl;
      if (imageUrl && isLowQualityUrl(imageUrl)) imageUrl = null;
      if (imageUrl && isAsianFoodImage(imageUrl)) {
        console.log(`[4jesoloevents] Blocking Asian food image: ${imageUrl}`);
        imageUrl = null;
      }

      // Build source URL
      const sourceUrl = listing.detailUrl || BASE_URL;

      // City: always Jesolo for this source
      const city = listing.city || "Jesolo";

      const event: NormalizedEvent = {
        title,
        normalizedTitle: normalizeText(title),
        slug: generateSlug(title, city),
        city,
        province: "VE", // Always Venezia province for Jesolo
        startDate: listing.startDate,
        endDate: listing.endDate || listing.startDate,
        priceInfo: null,
        isFree: null,
        imageUrl,
        url: sourceUrl,
        sourceDescription: description,
        contentHash: generateContentHash(title, city, listing.startDate),
        lat: detailData.lat,
        lng: detailData.lng,
      };

      totalFound++;
      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[4jesoloevents] ${result}: "${event.title}" (${event.city}, ${event.province}) coords=${event.lat != null}`);
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, filtered=${totalFiltered}, listing_total=${listingEvents.length}`);
    console.log(`[4jesoloevents] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, filtered=${totalFiltered}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[4jesoloevents] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-4jesoloevents] Starting - scraping 4jesoloevents.it`);

  EdgeRuntime.waitUntil(scrape4JesoloEvents(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "4jesoloevents",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
