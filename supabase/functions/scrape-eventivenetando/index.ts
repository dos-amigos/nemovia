// =============================================================================
// scrape-eventivenetando — Scrape sagre from eventivenetando.it
// Uses: https://www.eventivenetando.it/it/ricerca-eventi?categoria_5=1
// HTML listing page for feste e sagre in Marca Trevigiana (northern TV).
// No GPS → status = pending_geocode.
// =============================================================================

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

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

const ASIAN_FOOD_REGEX = /\b(sushi|sashimi|ramen|noodle|wok|chopstick|bacchett[eai]|cinese|giapponese|asian|asiatico|asiatica|chinese|japanese|thai|dim\s*sum|tempura|gyoza|udon|pho|bibimbap|kimchi|teriyaki|wasabi|miso|tofu|pad\s*thai|satay|curry|tandoori|naan|samosa|dumpling|bao|spring\s*roll|involtini\s*primavera|edamame|sake|matcha|bubble\s*tea|bento|onigiri|takoyaki|okonomiyaki)\b/i;

function isLowQualityUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  for (const pattern of BAD_IMAGE_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  return false;
}

function isAsianFoodImage(url: string | null | undefined): boolean {
  if (!url) return false;
  return ASIAN_FOOD_REGEX.test(url);
}

// --- Italian date parsing ---

const ITALIAN_MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6,
  lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
};

function parseItalianDate(text: string): string | null {
  const monthNameMatch = text.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\.?\s*(\d{4})?/i);
  if (monthNameMatch) {
    const day = parseInt(monthNameMatch[1], 10);
    const month = ITALIAN_MONTHS[monthNameMatch[2].toLowerCase()];
    const year = monthNameMatch[3] ? parseInt(monthNameMatch[3], 10) : new Date().getFullYear();
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const numMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (numMatch) {
    const day = parseInt(numMatch[1], 10);
    const month = parseInt(numMatch[2], 10);
    const year = parseInt(numMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

function parseDateRange(text: string): [string | null, string | null] {
  // "dal DD mese al DD mese YYYY"
  const rangeMatch = text.match(/dal\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+al\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})?/i);
  if (rangeMatch) {
    const year = rangeMatch[5] ? parseInt(rangeMatch[5], 10) : new Date().getFullYear();
    const startMonth = ITALIAN_MONTHS[rangeMatch[2].toLowerCase()];
    const endMonth = ITALIAN_MONTHS[rangeMatch[4].toLowerCase()];
    if (startMonth && endMonth) {
      const sd = `${year}-${String(startMonth).padStart(2, "0")}-${String(parseInt(rangeMatch[1], 10)).padStart(2, "0")}`;
      const ed = `${year}-${String(endMonth).padStart(2, "0")}-${String(parseInt(rangeMatch[3], 10)).padStart(2, "0")}`;
      return [sd, ed];
    }
  }

  // "dal DD al DD mese YYYY"
  const samMonthRange = text.match(/dal\s+(\d{1,2})\s+al\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})?/i);
  if (samMonthRange) {
    const year = samMonthRange[4] ? parseInt(samMonthRange[4], 10) : new Date().getFullYear();
    const month = ITALIAN_MONTHS[samMonthRange[3].toLowerCase()];
    if (month) {
      const sd = `${year}-${String(month).padStart(2, "0")}-${String(parseInt(samMonthRange[1], 10)).padStart(2, "0")}`;
      const ed = `${year}-${String(month).padStart(2, "0")}-${String(parseInt(samMonthRange[2], 10)).padStart(2, "0")}`;
      return [sd, ed];
    }
  }

  // DD/MM/YYYY - DD/MM/YYYY
  const numRangeMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*[-–]\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (numRangeMatch) {
    const sd = `${numRangeMatch[3]}-${numRangeMatch[2].padStart(2, "0")}-${numRangeMatch[1].padStart(2, "0")}`;
    const ed = `${numRangeMatch[6]}-${numRangeMatch[5].padStart(2, "0")}-${numRangeMatch[4].padStart(2, "0")}`;
    return [sd, ed];
  }

  const single = parseItalianDate(text);
  if (single) return [single, single];

  return [null, null];
}

// --- Upsert logic ---

async function upsertEvent(
  supabase: SupabaseClient,
  event: NormalizedEvent,
  sourceName: string
): Promise<{ result: "inserted" | "merged" | "skipped"; id?: string }> {
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
      insertData.slug = event.slug + "-" + Date.now().toString(36);
      insertData.content_hash = event.contentHash + Date.now().toString(36);
      const { data: retryData } = await supabase.from("sagre")
        .insert(insertData)
        .select("id")
        .single();
      return { result: "inserted", id: retryData?.id };
    }
    console.error(`[eventivenetando] Insert error: ${error.message}`);
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
    source_name:     "eventivenetando",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- HTML fetch helper ---

async function fetchPage(url: string): Promise<string> {
  console.log(`[eventivenetando] Fetching: ${url}`);
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 25_000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Nemovia/1.0; +https://nemovia.it)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(tid);
  }
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

// --- Parse HTML listing ---

function parseListingPage(html: string): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const seenTitles = new Set<string>();
  const baseUrl = "https://www.eventivenetando.it";

  // The site uses event cards/listings. Try multiple patterns:
  // Pattern 1: Event cards with <a> links and title/location/date info
  // Pattern 2: <article> or <div class="event"> blocks

  // Try to extract event blocks - look for common event card patterns
  // Pattern: <div class="...event..."> or <article> containing title + link + date
  const eventBlockPattern = /<(?:article|div|li)[^>]*class="[^"]*(?:event|evento|listing|item|card)[^"]*"[^>]*>([\s\S]*?)<\/(?:article|div|li)>/gi;
  const blocks: string[] = [];
  let match;

  while ((match = eventBlockPattern.exec(html)) !== null) {
    blocks.push(match[1]);
  }

  // If no structured blocks found, try to find all links that look like event detail pages
  if (blocks.length === 0) {
    // Look for links containing /it/evento/ or /it/eventi/ or similar patterns
    const linkPattern = /<a[^>]*href="(\/it\/[^"]*evento[^"]*|\/it\/[^"]*event[^"]*|\/[^"]*sagr[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = linkPattern.exec(html)) !== null) {
      blocks.push(match[0]);
    }
  }

  // If still nothing, try all <a> with titles
  if (blocks.length === 0) {
    const allLinksPattern = /<a[^>]*href="([^"]*)"[^>]*title="([^"]*)"[^>]*>/gi;
    while ((match = allLinksPattern.exec(html)) !== null) {
      blocks.push(`<a href="${match[1]}" title="${match[2]}">${match[2]}</a>`);
    }
  }

  // Fallback: extract all meaningful links from the page
  if (blocks.length === 0) {
    const genericLinkPattern = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = genericLinkPattern.exec(html)) !== null) {
      const href = match[1];
      const text = stripHtmlTags(decodeHtmlEntities(match[2])).trim();
      // Only include links that look like event pages (not nav/footer)
      if (text.length >= 10 && text.length <= 200 && !isNoiseTitle(text)) {
        if (/evento|event|sagra|festa|feste/i.test(href) || /sagra|festa|feste/i.test(text)) {
          blocks.push(match[0]);
        }
      }
    }
  }

  for (const block of blocks) {
    // Extract title from the block
    // Try <h2>, <h3>, <h4> first, then <a> text, then general text
    let title = "";
    let link = "";

    const headingMatch = block.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i);
    if (headingMatch) {
      title = stripHtmlTags(decodeHtmlEntities(headingMatch[1])).trim();
    }

    const linkMatch = block.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (linkMatch) {
      link = linkMatch[1];
      if (!title) {
        title = stripHtmlTags(decodeHtmlEntities(linkMatch[2])).trim();
      }
    }

    // Try title attribute
    if (!title) {
      const titleAttr = block.match(/title="([^"]*)"/i);
      if (titleAttr) title = decodeHtmlEntities(titleAttr[1]).trim();
    }

    if (!title || title.length < 5) continue;

    // Build full URL
    const eventUrl = link
      ? (link.startsWith("http") ? link : `${baseUrl}${link.startsWith("/") ? "" : "/"}${link}`)
      : `${baseUrl}/it/ricerca-eventi?categoria_5=1`;

    // Apply filters
    if (isNoiseTitle(title)) {
      console.log(`[eventivenetando] Skipping noise title: "${title}"`);
      continue;
    }
    if (isNonSagraTitle(title)) {
      console.log(`[eventivenetando] Skipping non-sagra title: "${title}"`);
      continue;
    }

    // Extract description text from the block
    const blockText = stripHtmlTags(decodeHtmlEntities(block)).trim();
    if (containsPastYear(title, eventUrl, blockText)) {
      console.log(`[eventivenetando] Skipping past year: "${title}"`);
      continue;
    }

    // Deduplicate
    const normTitle = normalizeText(title);
    if (seenTitles.has(normTitle)) continue;
    seenTitles.add(normTitle);

    // Extract city from the block text
    let city = "";
    // Look for location patterns in the block: "Luogo: ...", "dove: ...", city name
    const locationMatch = blockText.match(/(?:luogo|dove|localit[aà]|comune|citt[aà])[\s:]+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i);
    if (locationMatch) {
      city = locationMatch[1].trim();
    }

    // Try province extraction
    let province = "TV"; // Default for eventivenetando (Marca Trevigiana)
    const provMatch = blockText.match(/\(([A-Z]{2})\)/);
    if (provMatch) {
      const resolved = resolveProvince(provMatch[1]);
      if (resolved) province = resolved;
    }

    // Try to extract city from title itself
    if (!city) {
      const titleCityMatch = title.match(/\s+(?:a|di|in)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/i);
      if (titleCityMatch) {
        city = titleCityMatch[1].trim();
      }
    }

    if (!city) city = "Treviso";

    // Extract dates
    const [startDate, endDate] = parseDateRange(blockText);

    // Skip past events
    if (startDate) {
      const eventEnd = endDate || startDate;
      if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
        console.log(`[eventivenetando] Skipping past event: "${title}" (ends ${eventEnd})`);
        continue;
      }
    }

    // Extract image
    let imageUrl: string | null = null;
    const imgMatch = block.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
    if (imgMatch) {
      let imgSrc = imgMatch[1];
      if (!imgSrc.startsWith("http")) {
        imgSrc = `${baseUrl}${imgSrc.startsWith("/") ? "" : "/"}${imgSrc}`;
      }
      if (!isLowQualityUrl(imgSrc) && !isAsianFoodImage(imgSrc)) {
        imageUrl = imgSrc;
      }
    }

    const sourceDescription = blockText.length > 10 ? blockText.slice(0, 2000) : null;

    const event: NormalizedEvent = {
      title: title.slice(0, 200),
      normalizedTitle: normTitle,
      slug: generateSlug(title, city),
      city,
      province,
      startDate,
      endDate: endDate || startDate,
      priceInfo: null,
      isFree: null,
      imageUrl,
      url: eventUrl,
      sourceDescription,
      contentHash: generateContentHash(title, city, startDate),
    };

    events.push(event);
  }

  return events;
}

// --- Main scraping logic ---

const SOURCE_NAME = "eventivenetando";
const BASE_URL = "https://www.eventivenetando.it/it/ricerca-eventi?categoria_5=1";

async function scrapeEventivenetando(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  try {
    // Fetch the main listing page
    const html = await fetchPage(BASE_URL);
    console.log(`[eventivenetando] Fetched ${html.length} bytes from listing page`);

    const events = parseListingPage(html);
    totalFound = events.length;
    console.log(`[eventivenetando] Parsed ${totalFound} events from listing`);

    // Also try page 2 if the site supports pagination
    try {
      const page2Urls = [
        `${BASE_URL}&page=2`,
        `${BASE_URL}&pagina=2`,
        `${BASE_URL}&p=2`,
      ];
      for (const p2url of page2Urls) {
        if (Date.now() - startedAt > 60_000) break;
        try {
          const html2 = await fetchPage(p2url);
          if (html2.length > 1000 && html2 !== html) {
            const moreEvents = parseListingPage(html2);
            if (moreEvents.length > 0) {
              console.log(`[eventivenetando] Page 2 found ${moreEvents.length} more events`);
              // Filter out duplicates
              for (const ev of moreEvents) {
                if (!events.some(e => e.normalizedTitle === ev.normalizedTitle)) {
                  events.push(ev);
                  totalFound++;
                }
              }
              break; // Found working pagination URL
            }
          }
        } catch {
          // pagination URL didn't work, try next
        }
      }
    } catch {
      // pagination failed, continue with page 1 results
    }

    for (const event of events) {
      if (Date.now() - startedAt > 110_000) {
        console.log(`[eventivenetando] Time budget exceeded, stopping`);
        break;
      }

      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[eventivenetando] ${result}: "${event.title}" (${event.city}, ${event.province})`);
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}`);
    console.log(`[eventivenetando] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[eventivenetando] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-eventivenetando] Starting -- eventivenetando.it HTML listing`);

  EdgeRuntime.waitUntil(scrapeEventivenetando(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "eventivenetando",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
