// =============================================================================
// scrape-eventivicenza — Scrape sagre/food events from eventi.comune.vicenza.it
// Uses the public OpenData REST API (OpenAgenda platform).
// Fetches events sorted by date desc, filters for food/sagra-related events,
// extracts GPS coords from API response.
// GPS included → status starts at pending_llm (skip geocoding).
// Province is always VI (Vicenza).
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
  // Whitelist: food/sagra-related keywords — always keep
  if (
    /\b(sagra|sagre|festa|feste|gastronomic|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia)/i.test(t)
  ) {
    return false;
  }
  // Blacklist: non-food event types
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

// --- Anti-Asian food filter (RULE N.1 — ABSOLUTE) ---

const ASIAN_FOOD_REGEX = /\b(sushi|sashimi|ramen|noodle|wok|chopstick|bacchette|asian|asiatico|asiatica|chinese|cinese|japanese|giapponese|thai|tailandese|korean|coreano|curry|tandoori|dim[\s-]?sum|bao|gyoza|tempura|teriyaki|wasabi|miso|tofu|edamame|udon|soba|pho|bibimbap|kimchi|satay|pad[\s-]?thai|spring[\s-]?roll|involtini[\s-]?primavera|samosa|naan|chapati|dosa|biryani)\b/i;

function containsAsianFood(text: string | null | undefined): boolean {
  if (!text) return false;
  return ASIAN_FOOD_REGEX.test(text);
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
  // Anti-Asian food filter on image URLs
  if (containsAsianFood(url)) return true;
  return false;
}

// --- Food/sagra relevance check ---
// The API returns ALL events (concerts, exhibitions, etc.).
// We only want food-related events (sagre, feste gastronomiche, etc.)

const FOOD_KEYWORDS_TITLE = /\b(sagra|sagre|festa\b.*\b(cibo|gastronomic|culinari|prodott)|enogastronomic|gastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia|grigliat|porchetta|castagne|marroni|nocciole|patata|patate|fagioli|luganega|cotechino|salame|prosciutto|soppressa|bigoli|bisi|trippe|musso|rane|lumache|gallina|pollo|maiale|manzo|cinghiale|stoccafisso|fritto|frittura|bruschett|gnoc[ch]i|malga|casearia|tartufo|tartufi|ravioli|tortelli|lasagne|tagliatelle|tagliolini|pappardelle|fettuccine|carbonara|amatriciana|cacio\s*e\s*pepe|tiramisu|pandoro|panettone|bussolai|baicoli|fritole|frittelle|galani|crostoli|focaccia|pizza|pizze)\b/i;

const FOOD_KEYWORDS_DESCRIPTION = /\b(sagra|enogastronomic|gastronomic|stand\s+gastronom|cucina\s+tipica|piatti\s+tipici|specialit[aà]\s+local|men[uù]\s+tipic|degustazion|prodotti\s+tipici|chiosco|chioschi|ristoro|ristorazion|street\s*food|cibo\s+di\s+strada)\b/i;

const FOOD_EVENT_TYPES = /\b(sagra|festa\s+popolare|festa\s+paesana|evento\s+enogastronomico|festa\s+patronale)\b/i;

function isFoodRelatedEvent(
  title: string,
  description: string | null,
  eventType: string | null,
  topics: string[] | null
): boolean {
  // Check title (strongest signal)
  if (FOOD_KEYWORDS_TITLE.test(title)) return true;

  // Check event type from API
  if (eventType && FOOD_EVENT_TYPES.test(eventType)) return true;

  // Check topics
  if (topics) {
    for (const topic of topics) {
      if (/enogastronomia|gastronomia|cibo|food|sagra/i.test(topic)) return true;
    }
  }

  // Check description for food-related keywords
  if (description && FOOD_KEYWORDS_DESCRIPTION.test(description)) return true;

  // "Festa" in title + food keywords in description = food event
  if (/\bfesta\b/i.test(title) && description) {
    if (FOOD_KEYWORDS_TITLE.test(description)) return true;
  }

  return false;
}

// --- HTTP fetch helpers ---

async function fetchHtml(url: string, timeoutMs = 10_000): Promise<string | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Nemovia/1.0; +https://nemovia.it)",
        "Accept": "text/html",
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

/** Fetch og:image from event page HTML */
async function fetchOgImage(pageUrl: string): Promise<string | null> {
  const html = await fetchHtml(pageUrl);
  if (!html) return null;
  const $ = cheerio.load(html);
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && !isLowQualityUrl(ogImage)) {
    // Ensure absolute URL
    if (ogImage.startsWith("http")) return ogImage;
    return `https://eventi.comune.vicenza.it${ogImage}`;
  }
  // Fallback: first content image
  const contentImg = $("article img, .content img, .event-image img").first().attr("src");
  if (contentImg && !isLowQualityUrl(contentImg)) {
    if (contentImg.startsWith("http")) return contentImg;
    return `https://eventi.comune.vicenza.it${contentImg}`;
  }
  return null;
}

async function fetchJson(url: string, timeoutMs = 15_000): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Nemovia/1.0; +https://nemovia.it)",
        "Accept": "application/json",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.5",
      },
    });
    if (!resp.ok) {
      console.log(`[eventivicenza] HTTP ${resp.status} for ${url}`);
      return null;
    }
    return await resp.json();
  } catch (err) {
    console.error(`[eventivicenza] Fetch error for ${url}:`, err instanceof Error ? err.message : String(err));
    return null;
  } finally {
    clearTimeout(tid);
  }
}

// --- Parse API event into NormalizedEvent ---

function parseApiEvent(hit: Record<string, unknown>): NormalizedEvent | null {
  const metadata = hit.metadata as Record<string, unknown> | undefined;
  const data = hit.data as Record<string, Record<string, unknown>> | undefined;
  const extradata = hit.extradata as Record<string, Record<string, unknown>> | undefined;

  if (!data || !metadata) return null;

  // Language key — always ita-IT
  const lang = data["ita-IT"];
  if (!lang) return null;

  // --- Title ---
  const rawTitle = String(lang.event_title || (metadata.name as Record<string, string>)?.["ita-IT"] || "").trim();
  const title = decodeHtmlEntities(rawTitle);
  if (!title) return null;

  // --- Apply noise/non-sagra filters ---
  if (isNoiseTitle(title)) {
    console.log(`[eventivicenza] Skipping noise title: "${title}"`);
    return null;
  }

  // --- Extract event type ---
  let eventType: string | null = null;
  const typologyArr = lang.has_public_event_typology as Array<Record<string, Record<string, string>>> | undefined;
  if (typologyArr && typologyArr.length > 0) {
    eventType = typologyArr.map(t => t.name?.["ita-IT"] || "").join(", ");
  }

  // --- Extract topics ---
  let topics: string[] | null = null;
  const topicsArr = lang.topics as Array<Record<string, Record<string, string>>> | undefined;
  if (topicsArr && topicsArr.length > 0) {
    topics = topicsArr.map(t => t.name?.["ita-IT"] || "").filter(Boolean);
  }

  // --- Extract description ---
  let description: string | null = null;
  const rawAbstract = lang.event_abstract as string | undefined;
  const rawDescription = lang.description as string | undefined;

  // Prefer full description, fall back to abstract
  const descText = rawDescription || rawAbstract || "";
  if (descText) {
    // Strip HTML tags
    description = decodeHtmlEntities(
      descText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    );
    if (description.length > 2000) description = description.slice(0, 2000);
    if (description.length < 10) description = null;
  }

  // --- Food relevance filter ---
  if (!isFoodRelatedEvent(title, description, eventType, topics)) {
    // Not a food/sagra event — skip silently (most events are concerts/exhibitions)
    return null;
  }

  // --- Apply non-sagra title filter AFTER food check (food keywords whitelist in isNonSagraTitle) ---
  if (isNonSagraTitle(title)) {
    console.log(`[eventivicenza] Skipping non-sagra title: "${title}"`);
    return null;
  }

  // --- Extract dates ---
  let startDate: string | null = null;
  let endDate: string | null = null;
  const timeInterval = lang.time_interval as Record<string, unknown> | undefined;
  if (timeInterval) {
    const input = timeInterval.input as Record<string, unknown> | undefined;
    if (input) {
      if (input.startDateTime) startDate = String(input.startDateTime).slice(0, 10);
      if (input.endDateTime) endDate = String(input.endDateTime).slice(0, 10);
      // "until" field may have the real end date for recurring events
      if (input.until) {
        const untilDate = String(input.until).slice(0, 10);
        if (!endDate || untilDate > endDate) endDate = untilDate;
      }
    }
  }

  // --- Apply past year filter ---
  if (containsPastYear(title, undefined, description ?? undefined)) {
    console.log(`[eventivicenza] Skipping past year: "${title}"`);
    return null;
  }

  // --- Skip past events ---
  if (startDate) {
    const eventEnd = endDate || startDate;
    const today = new Date().toISOString().slice(0, 10);
    if (eventEnd < today) {
      console.log(`[eventivicenza] Skipping past event: "${title}" (ends ${eventEnd})`);
      return null;
    }
  }

  // --- Skip events without any date ---
  if (!startDate) {
    console.log(`[eventivicenza] Skipping "${title}" — no date available`);
    return null;
  }

  // --- Extract location ---
  let city = "Vicenza"; // Default — these are Vicenza municipal events
  const takesPlaceIn = lang.takes_place_in as Array<Record<string, Record<string, string>>> | undefined;
  if (takesPlaceIn && takesPlaceIn.length > 0) {
    const placeName = takesPlaceIn[0].name?.["ita-IT"] || "";
    if (placeName) city = decodeHtmlEntities(placeName);
  }

  // Province is always VI for this source
  const province = "VI";

  // --- Extract GPS coordinates ---
  let lat: number | null = null;
  let lng: number | null = null;
  const extraLang = extradata?.["ita-IT"];
  if (extraLang) {
    const geoArr = extraLang.geo as Array<Record<string, string>> | undefined;
    if (geoArr && geoArr.length > 0) {
      lat = parseFloat(geoArr[0].latitude);
      lng = parseFloat(geoArr[0].longitude);
      if (isNaN(lat) || isNaN(lng)) { lat = null; lng = null; }
      // Validate Veneto bounding box (roughly lat 44.8-46.7, lng 10.6-13.1)
      if (lat != null && lng != null) {
        if (lat < 44.5 || lat > 47.0 || lng < 10.0 || lng > 13.5) {
          console.log(`[eventivicenza] Coords outside Veneto for "${title}": ${lat}, ${lng} — clearing`);
          lat = null;
          lng = null;
        }
      }
    }
  }

  // --- Extract image URL ---
  let imageUrl: string | null = null;
  const imageArr = lang.image as Array<Record<string, unknown>> | undefined;
  if (imageArr && imageArr.length > 0) {
    // The API returns image metadata with a "link" field like "read/14398"
    // We need to construct the URL to fetch the actual image file
    // Image URL pattern: https://eventi.comune.vicenza.it/opendata/api/content/{link}
    // But the actual image file is served from: /var/openagendavicenza/storage/images/...
    // For now, use the event page itself to get og:image later in enrichment
    // We can try the API content read endpoint to get the image URL
    const imgLink = imageArr[0].link as string | undefined;
    if (imgLink) {
      // The image read endpoint returns the file path — we construct a public URL
      // Pattern: https://eventi.comune.vicenza.it/opendata/api/content/{link}/image
      // Actually use the event page URL — enrichment pipeline will get the image
      imageUrl = null; // Will be fetched during enrichment
    }
  }

  // --- Build source URL ---
  let sourceUrl = `https://eventi.comune.vicenza.it`;
  if (extraLang) {
    const urlAlias = extraLang.urlAlias as string | undefined;
    if (urlAlias) {
      sourceUrl = `https://eventi.comune.vicenza.it${urlAlias}`;
    }
  }
  // Fallback: construct from metadata
  if (sourceUrl === "https://eventi.comune.vicenza.it" && metadata.id) {
    sourceUrl = `https://eventi.comune.vicenza.it/opendata/api/content/read/${metadata.id}`;
  }

  // --- Price info ---
  let priceInfo: string | null = null;
  let isFree: boolean | null = null;
  const isAccessibleForFree = lang.is_accessible_for_free;
  if (isAccessibleForFree === true || isAccessibleForFree === "true" || isAccessibleForFree === 1) {
    isFree = true;
    priceInfo = "Ingresso gratuito";
  } else if (isAccessibleForFree === false || isAccessibleForFree === "false" || isAccessibleForFree === 0) {
    isFree = false;
  }
  const costNotes = lang.cost_notes as string | undefined;
  if (costNotes && costNotes.trim()) {
    priceInfo = decodeHtmlEntities(costNotes.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (priceInfo.length > 200) priceInfo = priceInfo.slice(0, 200);
  }

  // --- Anti-Asian food filter on title/description ---
  if (containsAsianFood(title) || containsAsianFood(description)) {
    console.log(`[eventivicenza] Skipping Asian food content: "${title}"`);
    return null;
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
    imageUrl: imageUrl && !isLowQualityUrl(imageUrl) ? imageUrl : null,
    url: sourceUrl,
    sourceDescription: description,
    contentHash: generateContentHash(title, city, startDate),
    lat,
    lng,
  };
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

  // GPS coords available → skip geocoding, go straight to pending_llm
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
    console.error(`[eventivicenza] Insert error: ${error.message}`);
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
    source_name:     "eventivicenza",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Main scraping logic ---

const API_BASE = "https://eventi.comune.vicenza.it/opendata/api/content/search";
const BASE_QUERY = "classes [event] and subtree [65] and state in [moderation.skipped,moderation.accepted] sort [time_interval=>desc]";
const PAGE_SIZE = 30; // API default page size
const MAX_PAGES = 10; // 30 * 10 = 300 events max (most recent first)
const SOURCE_NAME = "eventivicenza";
const DELAY_MS = 1000; // politeness delay between API calls

async function scrapeEventiVicenza(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  let totalFiltered = 0;
  let pagesScraped = 0;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      // Time budget check (120s total)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[eventivicenza] Time budget exceeded, stopping`);
        break;
      }

      const offset = page * PAGE_SIZE;
      const query = page === 0
        ? BASE_QUERY
        : `${BASE_QUERY} offset ${offset}`;
      const url = `${API_BASE}?q=${encodeURIComponent(query)}`;

      console.log(`[eventivicenza] Fetching page ${page + 1} (offset ${offset}): ${url}`);

      const json = await fetchJson(url, 15_000);
      if (!json) {
        console.log(`[eventivicenza] No response for page ${page + 1}, stopping`);
        break;
      }

      const searchHits = json.searchHits as Array<Record<string, unknown>> | undefined;
      if (!searchHits || searchHits.length === 0) {
        console.log(`[eventivicenza] No results on page ${page + 1}, stopping`);
        break;
      }

      pagesScraped++;
      console.log(`[eventivicenza] Page ${page + 1}: ${searchHits.length} hits`);

      let pastEventsOnPage = 0;

      for (const hit of searchHits) {
        const event = parseApiEvent(hit);
        if (!event) {
          totalFiltered++;
          // Check if this was a past event (to detect when we've gone past all future events)
          const data = hit.data as Record<string, Record<string, unknown>> | undefined;
          const lang = data?.["ita-IT"];
          if (lang) {
            const ti = lang.time_interval as Record<string, Record<string, unknown>> | undefined;
            const input = ti?.input;
            if (input?.startDateTime) {
              const sd = String(input.startDateTime).slice(0, 10);
              const today = new Date().toISOString().slice(0, 10);
              if (sd < today) pastEventsOnPage++;
            }
          }
          continue;
        }

        totalFound++;

        // Try to fetch og:image from event page if no image from API
        if (!event.imageUrl && event.url.startsWith("https://eventi.comune.vicenza.it/")) {
          try {
            const ogImg = await fetchOgImage(event.url);
            if (ogImg && !containsAsianFood(ogImg)) {
              event.imageUrl = ogImg;
              console.log(`[eventivicenza] Got og:image for "${event.title}": ${ogImg}`);
            }
          } catch {
            // Non-critical — enrichment pipeline will handle images
          }
          // Brief delay after page fetch
          await new Promise(r => setTimeout(r, 500));
        }

        const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
        if (result === "inserted") totalInserted++;
        else if (result === "merged") totalMerged++;
        else totalSkipped++;

        console.log(`[eventivicenza] ${result}: "${event.title}" (${event.city}, ${event.startDate})`);
      }

      // If all events on this page are past events, stop — we've gone past all future events
      // (sorted desc, so once we hit all-past pages, no more future events ahead)
      if (pastEventsOnPage >= searchHits.length) {
        console.log(`[eventivicenza] All events on page ${page + 1} are past — stopping`);
        break;
      }

      // Politeness delay
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, filtered=${totalFiltered}, pages=${pagesScraped}`);
    console.log(`[eventivicenza] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, filtered=${totalFiltered}, pages=${pagesScraped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[eventivicenza] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-eventivicenza] Starting — scraping eventi.comune.vicenza.it OpenData API`);

  EdgeRuntime.waitUntil(scrapeEventiVicenza(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "eventivicenza",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
