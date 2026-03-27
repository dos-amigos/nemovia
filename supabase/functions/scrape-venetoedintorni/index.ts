// =============================================================================
// scrape-venetoedintorni — Scrape sagre from venetoedintorni.it
// Fetches listing page filtered by "sagre", extracts card data, then follows
// detail links for richer descriptions. Province extracted from card text.
// No GPS coords → status starts at pending_geocode.
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
  /default\.(jpg|png|gif|webp)/i,
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

// --- Date parsing: DD/MM/YYYY → YYYY-MM-DD ---

function parseItalianDate(dateStr: string): string | null {
  // Format: DD/MM/YYYY
  const match = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const d = day.padStart(2, "0");
  const m = month.padStart(2, "0");
  return `${year}-${m}-${d}`;
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
    console.error(`[venetoedintorni] Insert error: ${error.message}`);
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
    source_name:     "venetoedintorni",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Listing page parser: extract events from cards ---

const BASE_URL = "https://venetoedintorni.it/calendario-eventi-veneto/";
const LISTING_URL = "https://venetoedintorni.it/calendario-eventi-veneto/tipo=sagre";

interface CardEvent {
  title: string;
  city: string;
  province: string | null;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  detailUrl: string;
}

function parseListingPage(html: string): CardEvent[] {
  const $ = cheerio.load(html);
  const events: CardEvent[] = [];

  // Each event is inside a .hover-card (Bootstrap card with hover effects)
  $(".hover-card").each((_i: number, el: cheerio.Element) => {
    const card = $(el);

    // Title from h5
    const titleEl = card.find("h5").first();
    const title = titleEl.text().trim();
    if (!title) return;

    // Detail link — anchor with href ending in .html
    let detailUrl = "";
    card.find("a[href]").each((_j: number, aEl: cheerio.Element) => {
      const href = $(aEl).attr("href") || "";
      if (href.endsWith(".html") && /^\d+_/.test(href)) {
        detailUrl = href;
        return false; // break
      }
    });
    if (!detailUrl) {
      // Try any anchor that links to a detail page
      card.find("a[href$='.html']").each((_j: number, aEl: cheerio.Element) => {
        const href = $(aEl).attr("href") || "";
        if (href && !href.includes("tipo=")) {
          detailUrl = href;
          return false;
        }
      });
    }

    // Build full URL for detail page
    const fullDetailUrl = detailUrl
      ? (detailUrl.startsWith("http") ? detailUrl : `${BASE_URL}${detailUrl}`)
      : "";

    // Image from card-img-top or first img
    let imageUrl: string | null = null;
    const imgSrc = card.find("img").first().attr("src") || "";
    if (imgSrc && !isLowQualityUrl(imgSrc) && !imgSrc.includes("default.")) {
      imageUrl = imgSrc.startsWith("http")
        ? imgSrc
        : `https://venetoedintorni.it/calendario-eventi-veneto/${imgSrc}`;
    }

    // Province — uppercase text like "VENEZIA", "PADOVA" etc
    // It appears as a badge/span in the card. We search all text nodes.
    const cardText = card.text();
    let provinceRaw: string | null = null;
    const provinceMatch = cardText.match(
      /\b(BELLUNO|PADOVA|ROVIGO|TREVISO|VENEZIA|VICENZA|VERONA)\b/
    );
    if (provinceMatch) {
      provinceRaw = provinceMatch[1];
    }

    // City — text near the title, usually in a <p> or small text
    // Look for city text by checking text of child elements
    let city = "";
    card.find("p, span, small").each((_k: number, pEl: cheerio.Element) => {
      const pText = $(pEl).text().trim();
      // Skip date ranges (contain "/")
      if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(pText)) return;
      // Skip category tags (contain common non-city words)
      if (/\b(Sagra|Sagre|Enogastronomia|Festa|Feste|Mostra|Teatro|Cultura|Musica|Sport|Mercatino)\b/i.test(pText) && pText.length > 20) return;
      // Skip province names we already captured
      if (/^(BELLUNO|PADOVA|ROVIGO|TREVISO|VENEZIA|VICENZA|VERONA)$/i.test(pText)) return;
      // Skip numeric-only, very short, or "In corso" / "Dettagli"
      if (pText.length < 2 || /^\d+$/.test(pText)) return;
      if (/^(in corso|dettagli|eventi)$/i.test(pText)) return;
      // Likely city name: short text that is not a date or category
      if (!city && pText.length >= 2 && pText.length <= 60 && !/\//.test(pText)) {
        // Additional check: should not be a month or day abbreviation
        if (!/^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Gen|Mag|Giu|Lug|Ago|Set|Ott|Dic)\b/i.test(pText)) {
          city = pText;
        }
      }
    });

    // Date range — format: DD/MM/YYYY - DD/MM/YYYY
    let startDate: string | null = null;
    let endDate: string | null = null;
    const dateRangeMatch = cardText.match(
      /(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/
    );
    if (dateRangeMatch) {
      startDate = parseItalianDate(dateRangeMatch[1]);
      endDate = parseItalianDate(dateRangeMatch[2]);
    } else {
      // Single date
      const singleDateMatch = cardText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (singleDateMatch) {
        startDate = parseItalianDate(singleDateMatch[1]);
        endDate = startDate;
      }
    }

    events.push({
      title,
      city,
      province: resolveProvince(provinceRaw),
      startDate,
      endDate,
      imageUrl,
      detailUrl: fullDetailUrl,
    });
  });

  return events;
}

// --- Detail page parser: extract richer description ---

function parseDetailPage(html: string): { description: string | null; imageUrl: string | null } {
  const $ = cheerio.load(html);

  // Try og:image first
  let imageUrl: string | null = null;
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && !isLowQualityUrl(ogImage) && !ogImage.includes("default.")) {
    imageUrl = ogImage.startsWith("http")
      ? ogImage
      : `https://venetoedintorni.it${ogImage}`;
  }

  // Extract description from page content
  let description: string | null = null;

  // Try meta description
  const metaDesc = $('meta[name="description"]').attr("content");

  // Try main content area — look for paragraphs with substantial text
  const paragraphs: string[] = [];
  $("p").each((_i: number, el: cheerio.Element) => {
    const text = $(el).text().trim();
    if (text.length > 30 && !/cookie|privacy|copyright/i.test(text)) {
      paragraphs.push(text);
    }
  });

  if (paragraphs.length > 0) {
    description = paragraphs.join("\n\n");
    if (description.length > 2000) description = description.slice(0, 2000);
  } else if (metaDesc && metaDesc.length > 20) {
    description = metaDesc;
  }

  if (description) {
    description = decodeHtmlEntities(description.replace(/\s+/g, " ").trim());
    if (description.length < 15) description = null;
  }

  return { description, imageUrl };
}

// --- Main scraping logic ---

const SOURCE_NAME = "venetoedintorni";
const DELAY_MS = 1500; // politeness delay

async function scrapeVenetoEdintorni(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  try {
    // Phase 1: Fetch listing page (single page, no pagination)
    console.log(`[venetoedintorni] Fetching listing: ${LISTING_URL}`);
    const listingHtml = await fetchWithTimeout(LISTING_URL, 20_000);
    if (!listingHtml) {
      throw new Error("Failed to fetch listing page");
    }

    const cardEvents = parseListingPage(listingHtml);
    console.log(`[venetoedintorni] Found ${cardEvents.length} cards on listing page`);

    // Phase 2: Process each card, optionally fetching detail pages
    for (const card of cardEvents) {
      // Time budget check (120s total)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[venetoedintorni] Time budget exceeded, stopping`);
        break;
      }

      const title = decodeHtmlEntities(card.title);

      // Apply filters
      if (isNoiseTitle(title)) {
        console.log(`[venetoedintorni] Skipping noise title: "${title}"`);
        continue;
      }
      if (isNonSagraTitle(title)) {
        console.log(`[venetoedintorni] Skipping non-sagra title: "${title}"`);
        continue;
      }
      if (containsPastYear(title, card.detailUrl)) {
        console.log(`[venetoedintorni] Skipping past year: "${title}"`);
        continue;
      }

      // Skip past events
      if (card.startDate) {
        const eventEnd = card.endDate || card.startDate;
        if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
          console.log(`[venetoedintorni] Skipping past event: "${title}" (ends ${eventEnd})`);
          continue;
        }
      }

      // Skip events without any date
      if (!card.startDate) {
        console.log(`[venetoedintorni] Skipping "${title}" — no date available`);
        continue;
      }

      // Validate province — must be Veneto
      if (!card.province) {
        console.log(`[venetoedintorni] Skipping "${title}" — no province resolved`);
        continue;
      }

      // Fetch detail page for richer description
      let description: string | null = null;
      let imageUrl = card.imageUrl;

      if (card.detailUrl) {
        console.log(`[venetoedintorni] Fetching detail: ${card.detailUrl}`);
        const detailHtml = await fetchWithTimeout(card.detailUrl, 10_000);
        if (detailHtml) {
          const detail = parseDetailPage(detailHtml);
          if (detail.description) description = detail.description;
          if (detail.imageUrl && !imageUrl) imageUrl = detail.imageUrl;
        }
        await new Promise(r => setTimeout(r, DELAY_MS));
      }

      const city = decodeHtmlEntities(card.city);

      const event: NormalizedEvent = {
        title: title.slice(0, 200),
        normalizedTitle: normalizeText(title),
        slug: generateSlug(title, city),
        city,
        province: card.province,
        startDate: card.startDate,
        endDate: card.endDate || card.startDate,
        priceInfo: null,
        isFree: null,
        imageUrl,
        url: card.detailUrl || LISTING_URL,
        sourceDescription: description,
        contentHash: generateContentHash(title, city, card.startDate),
      };

      totalFound++;
      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[venetoedintorni] ${result}: "${event.title}" (${event.city}, ${event.province})`);
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, cards=${cardEvents.length}`);
    console.log(`[venetoedintorni] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[venetoedintorni] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-venetoedintorni] Starting — scraping venetoedintorni.it sagre`);

  EdgeRuntime.waitUntil(scrapeVenetoEdintorni(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "venetoedintorni",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
