// =============================================================================
// scrape-primarovigo — Scrape sagre from primarovigo.it (local news portal)
// Fetches the sagre-e-feste category page and search results for "sagra",
// follows detail links, parses article content for event info.
// Province always "RO" (Rovigo-only portal).
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

// --- Date parsing helpers ---

const ITALIAN_MONTHS: Record<string, string> = {
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04",
  maggio: "05", giugno: "06", luglio: "07", agosto: "08",
  settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
};

/**
 * Parse Italian date strings like "20 giugno 2026", "sabato 5 luglio 2026",
 * "dal 15 al 18 agosto 2026", etc.
 * Returns { start: "YYYY-MM-DD", end: "YYYY-MM-DD" | null }
 */
function parseItalianDate(text: string): { start: string | null; end: string | null } {
  const t = text.toLowerCase();

  // Range: "dal 15 al 18 agosto 2026" or "15-18 agosto 2026"
  const rangeMatch = t.match(
    /(?:dal\s+)?(\d{1,2})\s*(?:al|-)\s*(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/
  );
  if (rangeMatch) {
    const [, d1, d2, month, year] = rangeMatch;
    const m = ITALIAN_MONTHS[month];
    if (m) {
      return {
        start: `${year}-${m}-${d1.padStart(2, "0")}`,
        end: `${year}-${m}-${d2.padStart(2, "0")}`,
      };
    }
  }

  // Range across months: "dal 28 giugno al 2 luglio 2026"
  const crossMonthMatch = t.match(
    /(?:dal\s+)?(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(?:al\s+)?(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/
  );
  if (crossMonthMatch) {
    const [, d1, m1, d2, m2, year] = crossMonthMatch;
    const month1 = ITALIAN_MONTHS[m1];
    const month2 = ITALIAN_MONTHS[m2];
    if (month1 && month2) {
      return {
        start: `${year}-${month1}-${d1.padStart(2, "0")}`,
        end: `${year}-${month2}-${d2.padStart(2, "0")}`,
      };
    }
  }

  // Single date: "20 giugno 2026" or "sabato 20 giugno 2026"
  const singleMatch = t.match(
    /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/
  );
  if (singleMatch) {
    const [, day, month, year] = singleMatch;
    const m = ITALIAN_MONTHS[month];
    if (m) {
      return { start: `${year}-${m}-${day.padStart(2, "0")}`, end: null };
    }
  }

  // ISO date: 2026-06-20
  const isoMatch = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return { start: isoMatch[0], end: null };
  }

  return { start: null, end: null };
}

// --- City extraction from title/text ---

/** Known Rovigo province towns (most common) for extraction from article text */
const ROVIGO_TOWNS = [
  "Rovigo", "Adria", "Badia Polesine", "Lendinara", "Porto Viro",
  "Occhiobello", "Villadose", "Loreo", "Rosolina", "Porto Tolle",
  "Taglio di Po", "Ariano nel Polesine", "Papozze", "Corbola",
  "Fiesso Umbertiano", "Castelmassa", "Bergantino", "Melara",
  "Crespino", "Costa di Rovigo", "Polesella", "Pontecchio Polesine",
  "Lusia", "Gavello", "Villanova del Ghebbo", "Ceregnano",
  "Villanova Marchesana", "Ficarolo", "Canaro", "Salara",
  "Trecenta", "Giacciano con Baruchella", "San Bellino",
  "Bagnolo di Po", "Pincara", "Castelguglielmo", "Frassinelle Polesine",
  "Guarda Veneta", "Gaiba", "Bosaro", "Calto", "Canda",
  "Ceneselli", "Fratta Polesine", "San Martino di Venezze",
  "Arquà Polesine", "Villanova di Rovigo", "Anguillara Veneta",
  "Pettorazza Grimani", "Contarina",
];

function extractCityFromText(title: string, body: string): string {
  const combined = `${title} ${body}`;

  // Check for "a <Town>" or "di <Town>" pattern in title first
  for (const town of ROVIGO_TOWNS) {
    const pattern = new RegExp(`\\b(?:a|di|ad)\\s+${town.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
    if (pattern.test(title)) return town;
  }

  // Check for town names in body text
  for (const town of ROVIGO_TOWNS) {
    const pattern = new RegExp(`\\b${town.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
    if (pattern.test(combined)) return town;
  }

  return "";
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
    console.error(`[primarovigo] Insert error: ${error.message}`);
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
    source_name:     "primarovigo",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Listing page parser: extract article URLs ---

function extractArticleLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];

  $("a[href]").each((_i: number, el: cheerio.Element) => {
    let href = $(el).attr("href");
    if (!href) return;

    // Make absolute
    if (href.startsWith("/")) href = baseUrl + href;

    // Only primarovigo.it URLs
    if (!href.includes("primarovigo.it/")) return;

    // Skip category/tag/page links, only want article detail pages
    if (/\/(tag|category|page|author|wp-content|wp-admin|feed)\//i.test(href)) return;
    if (!/^https?:\/\/primarovigo\.it\/.+\/.+\/$/i.test(href) &&
        !/^https?:\/\/primarovigo\.it\/.+\/.+[^/]$/i.test(href)) return;

    // Must be under a content section
    if (!/\/(tempo-libero|attualita|cronaca|politica|sport)\//i.test(href)) return;

    if (!links.includes(href)) links.push(href);
  });

  return links;
}

// --- Detail page parser: extract sagra info from article ---

function parseDetailPage(html: string, sourceUrl: string): NormalizedEvent | null {
  const $ = cheerio.load(html);

  // Extract title from <h1> or og:title
  let title = $("h1.post-title, h1.entry-title, h1").first().text().trim();
  if (!title) {
    title = $('meta[property="og:title"]').attr("content") || "";
  }
  title = decodeHtmlEntities(title.trim());
  if (!title) return null;

  // --- Filter: skip "weekend roundup" articles (list multiple events, not a single sagra) ---
  if (/cosa\s+fare\s+a\s+rovigo/i.test(title)) {
    console.log(`[primarovigo] Skipping roundup article: "${title}"`);
    return null;
  }

  // Apply standard filters
  if (isNoiseTitle(title)) {
    console.log(`[primarovigo] Skipping noise title: "${title}"`);
    return null;
  }

  // For this source, articles MUST mention sagra/festa/food keywords to be relevant
  const titleLower = title.toLowerCase();
  const hasSagraKeyword = /\b(sagra|festa|fiera|gastronomic|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia|pane|anguilla|radicchio|zucca|maiale|cinghiale|oca|anatra|rane)\b/i.test(titleLower);
  if (!hasSagraKeyword) {
    // Check if isNonSagraTitle catches it
    if (isNonSagraTitle(title)) {
      console.log(`[primarovigo] Skipping non-sagra title: "${title}"`);
      return null;
    }
    // If title doesn't have any food/sagra keyword AND doesn't pass sagra filter, skip
    console.log(`[primarovigo] Skipping unrelated article: "${title}"`);
    return null;
  }

  // Extract description from article body
  let description: string | null = null;
  const bodySelectors = [
    ".entry-content", ".post-content", ".article-content",
    "article .content", ".single-post .content", "article",
  ];
  for (const sel of bodySelectors) {
    const bodyEl = $(sel).first();
    if (bodyEl.length > 0) {
      // Remove scripts, styles, nav, related posts
      bodyEl.find("script, style, nav, .related-posts, .share-buttons, .post-tags").remove();
      description = bodyEl.text().trim();
      if (description && description.length > 20) break;
      description = null;
    }
  }

  if (description) {
    description = decodeHtmlEntities(description.replace(/\s+/g, " ").trim());
    if (description.length > 2000) description = description.slice(0, 2000);
    if (description.length < 10) description = null;
  }

  // Apply past year filter
  if (containsPastYear(title, sourceUrl, description ?? undefined)) {
    console.log(`[primarovigo] Skipping past year: "${title}"`);
    return null;
  }

  // Extract dates from JSON-LD (NewsArticle datePublished) and from text
  let startDate: string | null = null;
  let endDate: string | null = null;

  // Try parsing dates from title + body
  const fullText = `${title} ${description ?? ""}`;
  const parsed = parseItalianDate(fullText);
  startDate = parsed.start;
  endDate = parsed.end;

  // If no date found in text, try JSON-LD datePublished as fallback
  if (!startDate) {
    $('script[type="application/ld+json"]').each((_i: number, el: cheerio.Element) => {
      try {
        const jsonData = JSON.parse($(el).text().trim());
        // Could be @graph array
        const article = jsonData["@type"] === "NewsArticle" ? jsonData :
          jsonData["@graph"]?.find((item: Record<string, unknown>) =>
            item["@type"] === "NewsArticle" || item["@type"] === "Article"
          );
        if (article?.datePublished) {
          startDate = String(article.datePublished).slice(0, 10);
        }
      } catch {
        // JSON parse error — skip
      }
    });
  }

  // Skip events without any date
  if (!startDate) {
    console.log(`[primarovigo] Skipping "${title}" — no date available`);
    return null;
  }

  // Skip past events
  if (startDate) {
    const eventEnd = endDate || startDate;
    if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
      console.log(`[primarovigo] Skipping past event: "${title}" (ends ${eventEnd})`);
      return null;
    }
  }

  // Extract city from title/body
  let city = extractCityFromText(title, description ?? "");
  if (!city) {
    // Fallback: try "a <CityName>" pattern with any capitalized word after "a "
    const cityMatch = title.match(/\ba\s+([A-Z][a-zà-ü]+(?:\s+(?:di|del|nel|in)\s+[A-Z][a-zà-ü]+)?)/);
    if (cityMatch) city = cityMatch[1].trim();
  }
  if (!city) city = "Rovigo"; // fallback for province capital

  // Extract image
  let imageUrl: string | null = null;
  // Try og:image
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && !isLowQualityUrl(ogImage)) {
    imageUrl = ogImage;
  }
  // Try first content image if no og:image
  if (!imageUrl) {
    const contentImg = $(".entry-content img, article img, .post-content img").first().attr("src");
    if (contentImg && !isLowQualityUrl(contentImg)) {
      imageUrl = contentImg.startsWith("http") ? contentImg : `https://primarovigo.it${contentImg}`;
    }
  }
  // Skip small thumbnails (420x-sized crops are ok for source, enrichment will replace)
  if (imageUrl && /\d+x\d+/.test(imageUrl)) {
    // Try to get full-size image by removing WP crop suffix
    const fullSizeUrl = imageUrl.replace(/-\d+x\d+\./, ".");
    imageUrl = fullSizeUrl;
  }

  // Price info — news articles rarely have structured price, check text
  let priceInfo: string | null = null;
  let isFree: boolean | null = null;
  if (description) {
    if (/\bingresso\s*(gratuito|libero|gratis)\b/i.test(description) ||
        /\bentrata\s*(gratuita|libera|gratis)\b/i.test(description) ||
        /\bgratis\b/i.test(description)) {
      isFree = true;
      priceInfo = "Ingresso gratuito";
    }
  }

  // Clean title: remove site name suffix if present
  title = title.replace(/\s*[-–—|]\s*Prima Rovigo.*$/i, "").trim();

  return {
    title: title.slice(0, 200),
    normalizedTitle: normalizeText(title),
    slug: generateSlug(title, city),
    city,
    province: "RO", // ALWAYS Rovigo province
    startDate,
    endDate: endDate || startDate,
    priceInfo,
    isFree,
    imageUrl,
    url: sourceUrl,
    sourceDescription: description,
    contentHash: generateContentHash(title, city, startDate),
  };
}

// --- Main scraping logic ---

const BASE_URL = "https://primarovigo.it";
const SOURCE_NAME = "primarovigo";
const DELAY_MS = 1500; // politeness delay

// Pages to scrape for sagra-related articles
const LISTING_URLS = [
  `${BASE_URL}/tempo-libero/sagre-e-feste/`,
  `${BASE_URL}/tempo-libero/fiere-e-manifestazioni/`,
  `${BASE_URL}/?s=sagra`,
  `${BASE_URL}/?s=festa+gastronomica`,
];

async function scrapePrimarovigo(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  try {
    // Phase 1: Collect all article URLs from listing/search pages
    const allArticleUrls: string[] = [];

    for (const listingUrl of LISTING_URLS) {
      // Time budget check
      if (Date.now() - startedAt > 110_000) {
        console.log(`[primarovigo] Time budget exceeded during listing collection`);
        break;
      }

      console.log(`[primarovigo] Fetching listing: ${listingUrl}`);
      const html = await fetchWithTimeout(listingUrl, 15_000);
      if (!html) {
        console.log(`[primarovigo] No HTML for: ${listingUrl}`);
        continue;
      }

      const links = extractArticleLinks(html, BASE_URL);
      console.log(`[primarovigo] Found ${links.length} article links on: ${listingUrl}`);

      for (const link of links) {
        if (!allArticleUrls.includes(link)) allArticleUrls.push(link);
      }

      // Politeness delay between listing pages
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    console.log(`[primarovigo] Total unique article URLs: ${allArticleUrls.length}`);

    // Phase 2: Fetch each article page and parse
    for (const articleUrl of allArticleUrls) {
      // Time budget check (120s total, stop at 110s)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[primarovigo] Time budget exceeded, stopping`);
        break;
      }

      console.log(`[primarovigo] Fetching article: ${articleUrl}`);
      const html = await fetchWithTimeout(articleUrl, 10_000);
      if (!html) {
        console.log(`[primarovigo] Failed to fetch: ${articleUrl}`);
        continue;
      }

      const event = parseDetailPage(html, articleUrl);
      if (!event) continue;

      totalFound++;
      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[primarovigo] ${result}: "${event.title}" (${event.city}, ${event.province})`);

      // Politeness delay between detail pages
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, article_urls=${allArticleUrls.length}`);
    console.log(`[primarovigo] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[primarovigo] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-primarovigo] Starting — scraping primarovigo.it sagre articles`);

  EdgeRuntime.waitUntil(scrapePrimarovigo(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "primarovigo",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
