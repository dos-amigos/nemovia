// =============================================================================
// scrape-easyvi — Scrape sagre from easyvi.it (Vicenza province events)
// Fetches the /getevents.php AJAX endpoint which returns HTML event cards,
// then follows detail page links for full descriptions.
// Province is always "VI" (Vicenza).
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
    .replace(/&eacute;/g, "\u00E9")
    .replace(/&agrave;/g, "\u00E0")
    .replace(/&ograve;/g, "\u00F2")
    .replace(/&ugrave;/g, "\u00F9")
    .replace(/&igrave;/g, "\u00EC")
    .replace(/&Agrave;/g, "\u00C0")
    .replace(/&Egrave;/g, "\u00C8");
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
    /\b(sagra|sagre|festa|feste|gastronomic|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia|tarassaco|rane|lumache|cinghiale|castagne|marroni)\b/i.test(t)
  ) {
    return false;
  }
  // Blocklist: non-food events
  if (
    /\b(passeggiata|camminata|marcia)\b/i.test(t) ||
    /\bcarnevale\b/i.test(t) ||
    /\b(concerto|concerti|recital)\b/i.test(t) ||
    /\b(mostra|mostre|esposizione)\b/i.test(t) ||
    /\b(antiquariato|collezionismo)\b/i.test(t) ||
    /\b(teatro|teatrale|commedia|spettacolo|stagione\s+teatrale)\b/i.test(t) ||
    /\b(maratona|corsa|gara\s+ciclistica|gara\s+podistica|gravel)\b/i.test(t) ||
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
    /\b(eco[-\s]?compattatore)\b/i.test(t) ||
    /\b(jazz|rock|pop|blues|classica)\b/i.test(t) ||
    /\b(minerali|olivetti|rinascimento|saggezza)\b/i.test(t)
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

// --- Anti-Asian food filter on image URLs ---

const ASIAN_FOOD_REGEX = /\b(sushi|sashimi|ramen|noodle|chopstick|wok|dim[\s_-]?sum|bao|gyoza|tempura|teriyaki|wasabi|miso|tofu|pad[\s_-]?thai|pho|bibimbap|kimchi|udon|soba|dumpling|spring[\s_-]?roll|fried[\s_-]?rice|asian|chinese|japanese|korean|thai|vietnamese|oriental|manga|anime|sakura|geisha|samurai|buddha|zen|bamboo|lotus|dragon|pagoda|kimono|lantern|chopstick)\b/i;

function hasAsianFoodContent(url: string | null | undefined): boolean {
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
  if (hasAsianFoodContent(url)) return true;
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
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

// --- Date parsing: DD/MM/YYYY → YYYY-MM-DD ---

function parseItalianDate(dateStr: string): string | null {
  const match = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// --- Parse listing page: extract event cards from /getevents.php HTML ---

interface ListingEvent {
  id: string;
  title: string;
  city: string;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  detailUrl: string;
  category: string | null;
}

function parseListingPage(html: string): ListingEvent[] {
  const $ = cheerio.load(html);
  const events: ListingEvent[] = [];

  $("article").each((_i: number, el: cheerio.Element) => {
    const $article = $(el);

    // Extract detail page URL and title
    const titleLink = $article.find("h2.entry-title a[href]").first();
    const detailUrl = titleLink.attr("href") || "";
    const rawTitle = titleLink.text().trim().replace(/<br[^>]*>/gi, " ").trim();
    const title = decodeHtmlEntities(rawTitle);

    if (!detailUrl || !title) return;

    // Extract event ID from URL: ?action=getEventDetails&type=event&id=XXXX
    const idMatch = detailUrl.match(/[?&]id=(\d+)/);
    if (!idMatch) return;
    const id = idMatch[1];

    // Extract city and dates from the <p> element under h2
    // Format: "CityName<br />DD/MM/YYYY - DD/MM/YYYY"
    const infoP = $article.find("h2.entry-title").next("p");
    const infoHtml = infoP.html() || "";
    const infoParts = infoHtml.split(/<br\s*\/?>/i);
    const city = (infoParts[0] || "").trim();
    const dateText = (infoParts[1] || "").trim();

    let startDate: string | null = null;
    let endDate: string | null = null;

    if (dateText) {
      const dateParts = dateText.split(/\s*-\s*/);
      startDate = parseItalianDate(dateParts[0] || "");
      endDate = dateParts[1] ? parseItalianDate(dateParts[1]) : startDate;
    }

    // Extract image URL from background-image style
    let imageUrl: string | null = null;
    const previewDiv = $article.find(".article-preview-image a[style]").first();
    const styleAttr = previewDiv.attr("style") || "";
    const bgMatch = styleAttr.match(/url\(["']?([^"')]+)["']?\)/);
    if (bgMatch && bgMatch[1]) {
      imageUrl = bgMatch[1];
      if (isLowQualityUrl(imageUrl)) imageUrl = null;
    }

    // Extract category from icon link
    let category: string | null = null;
    const catLink = $article.find("a[href*='cat=']").first();
    const catHref = catLink.attr("href") || "";
    const catMatch = catHref.match(/cat=([^&]+)/);
    if (catMatch) category = catMatch[1];

    events.push({ id, title, city, startDate, endDate, imageUrl, detailUrl, category });
  });

  return events;
}

// --- Parse detail page for description ---

function parseDetailPage(html: string): { description: string | null; address: string | null; website: string | null } {
  const $ = cheerio.load(html);

  // Extract description from event-description div
  let description: string | null = null;
  const descDiv = $(".event-description");
  if (descDiv.length > 0) {
    // Get text from <p> tags within event-description, excluding slider and form elements
    const paragraphs: string[] = [];
    descDiv.find("> p, > div > p").each((_i: number, el: cheerio.Element) => {
      const text = $(el).text().trim();
      if (text && text.length > 5) {
        paragraphs.push(decodeHtmlEntities(text));
      }
    });
    if (paragraphs.length > 0) {
      description = paragraphs.join("\n\n");
      if (description.length > 2000) description = description.slice(0, 2000);
      if (description.length < 10) description = null;
    }
  }

  // Extract address from sidebar
  let address: string | null = null;
  $(".address-row").each((_i: number, el: cheerio.Element) => {
    const label = $(el).find(".title").text().trim();
    if (/indirizzo/i.test(label)) {
      address = $(el).find(".address-row-content").text().trim();
      if (!address) {
        // Sometimes address is directly in the row
        const fullText = $(el).text().replace(label, "").trim();
        if (fullText) address = fullText;
      }
    }
  });

  // Extract website
  let website: string | null = null;
  $(".address-row").each((_i: number, el: cheerio.Element) => {
    const label = $(el).find(".title").text().trim();
    if (/sito\s*web/i.test(label)) {
      website = $(el).find("a").attr("href") || null;
    }
  });

  return { description, address, website };
}

// --- Upsert logic ---

async function upsertEvent(
  supabase: SupabaseClient,
  event: NormalizedEvent,
  locationText: string,
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
    location_text:      locationText,
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
    console.error(`[easyvi] Insert error: ${error.message}`);
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
    source_name:     "easyvi",
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

const LISTING_URL = "https://www.easyvi.it/getevents.php";
const DETAIL_BASE = "https://easyvi.it/event-detail-page/?action=getEventDetails&type=event&id=";
const SOURCE_NAME = "easyvi";
const DELAY_MS = 1500; // politeness delay

async function scrapeEasyvi(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  let totalFiltered = 0;

  try {
    // Phase 1: Fetch listing page (single endpoint returns all events)
    console.log(`[easyvi] Fetching listing: ${LISTING_URL}`);
    const listingHtml = await fetchWithTimeout(LISTING_URL, 20_000);
    if (!listingHtml) {
      throw new Error("Failed to fetch listing page");
    }

    const listingEvents = parseListingPage(listingHtml);
    console.log(`[easyvi] Found ${listingEvents.length} event cards in listing`);

    // Phase 2: Filter and process events
    for (const event of listingEvents) {
      // Time budget check (120s total)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[easyvi] Time budget exceeded, stopping`);
        break;
      }

      // Apply title filters
      if (isNoiseTitle(event.title)) {
        console.log(`[easyvi] Skipping noise title: "${event.title}"`);
        totalFiltered++;
        continue;
      }
      if (isNonSagraTitle(event.title)) {
        console.log(`[easyvi] Skipping non-sagra title: "${event.title}"`);
        totalFiltered++;
        continue;
      }

      // Skip events without dates
      if (!event.startDate) {
        console.log(`[easyvi] Skipping "${event.title}" — no date available`);
        totalFiltered++;
        continue;
      }

      // Apply past year filter
      if (containsPastYear(event.title, event.detailUrl)) {
        console.log(`[easyvi] Skipping past year: "${event.title}"`);
        totalFiltered++;
        continue;
      }

      // Skip past events
      const eventEnd = event.endDate || event.startDate;
      if (eventEnd && new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
        console.log(`[easyvi] Skipping past event: "${event.title}" (ends ${eventEnd})`);
        totalFiltered++;
        continue;
      }

      // Phase 3: Fetch detail page for description
      console.log(`[easyvi] Fetching detail for: "${event.title}" (id=${event.id})`);
      const detailUrl = `${DETAIL_BASE}${event.id}`;
      const detailHtml = await fetchWithTimeout(detailUrl, 10_000);

      let description: string | null = null;
      let address: string | null = null;

      if (detailHtml) {
        const detail = parseDetailPage(detailHtml);
        description = detail.description;
        address = detail.address;
      }

      // Build location text: prefer address + city, fallback to city only
      let locationText = event.city;
      if (address && address.length > 3) {
        locationText = `${address}, ${event.city}`;
      }

      const normalizedEvent: NormalizedEvent = {
        title: event.title.slice(0, 200),
        normalizedTitle: normalizeText(event.title),
        slug: generateSlug(event.title, event.city),
        city: event.city,
        province: "VI",
        startDate: event.startDate,
        endDate: event.endDate || event.startDate,
        priceInfo: null,
        isFree: null,
        imageUrl: event.imageUrl,
        url: detailUrl,
        sourceDescription: description,
        contentHash: generateContentHash(event.title, event.city, event.startDate),
      };

      totalFound++;
      const { result } = await upsertEvent(supabase, normalizedEvent, locationText, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[easyvi] ${result}: "${normalizedEvent.title}" (${event.city}, VI)`);

      // Politeness delay between detail page fetches
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, filtered=${totalFiltered}, listing_cards=${listingEvents.length}`);
    console.log(`[easyvi] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, filtered=${totalFiltered}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[easyvi] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-easyvi] Starting — scraping easyvi.it Vicenza events`);

  EdgeRuntime.waitUntil(scrapeEasyvi(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "easyvi",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
