// =============================================================================
// scrape-trevisoinfo — Scrape sagre from trevisoinfo.it static HTML page
// Uses: https://www.trevisoinfo.it/feste-sagre-provincia-di-treviso.htm
// Simple HTML page with <li> bullet lists. Province fixed to TV.
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
    console.error(`[trevisoinfo] Insert error: ${error.message}`);
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
    source_name:     "trevisoinfo",
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
  console.log(`[trevisoinfo] Fetching: ${url}`);
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

// --- Date parser ---
// Italian months mapping
const ITALIAN_MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6,
  lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
};

function parseItalianDate(text: string): string | null {
  // Try "DD mese YYYY" or "DD/MM/YYYY" or "DD-MM-YYYY"
  const monthNameMatch = text.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\.?\s*(\d{4})?/i);
  if (monthNameMatch) {
    const day = parseInt(monthNameMatch[1], 10);
    const month = ITALIAN_MONTHS[monthNameMatch[2].toLowerCase()];
    const year = monthNameMatch[3] ? parseInt(monthNameMatch[3], 10) : new Date().getFullYear();
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
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

// Try to extract date range: returns [startDate, endDate]
function parseDateRange(text: string): [string | null, string | null] {
  // Pattern: "dal DD mese al DD mese YYYY" or "DD-DD mese YYYY" or "DD mese - DD mese YYYY"
  const rangeMatch = text.match(/dal\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+al\s+(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})?/i);
  if (rangeMatch) {
    const year = rangeMatch[5] ? parseInt(rangeMatch[5], 10) : new Date().getFullYear();
    const startMonth = ITALIAN_MONTHS[rangeMatch[2].toLowerCase()];
    const endMonth = ITALIAN_MONTHS[rangeMatch[4].toLowerCase()];
    const startDay = parseInt(rangeMatch[1], 10);
    const endDay = parseInt(rangeMatch[3], 10);
    if (startMonth && endMonth) {
      const sd = `${year}-${String(startMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
      const ed = `${year}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
      return [sd, ed];
    }
  }

  // Pattern: "dal DD al DD mese YYYY"
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

  // Pattern: DD/MM/YYYY - DD/MM/YYYY
  const numRangeMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*[-–]\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (numRangeMatch) {
    const sd = `${numRangeMatch[3]}-${numRangeMatch[2].padStart(2, "0")}-${numRangeMatch[1].padStart(2, "0")}`;
    const ed = `${numRangeMatch[6]}-${numRangeMatch[5].padStart(2, "0")}-${numRangeMatch[4].padStart(2, "0")}`;
    return [sd, ed];
  }

  // Single date fallback
  const single = parseItalianDate(text);
  if (single) return [single, single];

  return [null, null];
}

// --- Parse HTML for events ---

function parseEvents(html: string): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const baseUrl = "https://www.trevisoinfo.it/feste-sagre-provincia-di-treviso.htm";

  // Extract <li> items - the page uses bullet lists for events
  // Each <li> typically has the event name, sometimes with location and date info
  // Also try to extract from <a> links within the content area
  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const aPattern = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  // Also try <h2>, <h3>, <strong> patterns that might contain event titles
  const blockPattern = /<(?:li|h[2-4]|p|div)[^>]*>([\s\S]*?)<\/(?:li|h[2-4]|p|div)>/gi;

  const seenTitles = new Set<string>();
  const rawBlocks: { text: string; link: string | null }[] = [];

  // Extract all <li> blocks
  let match;
  while ((match = liPattern.exec(html)) !== null) {
    const innerHtml = match[1];
    const text = stripHtmlTags(decodeHtmlEntities(innerHtml)).trim();
    if (!text || text.length < 8) continue;

    // Try to find link inside the <li>
    const linkMatch = innerHtml.match(/<a[^>]*href="([^"]*)"[^>]*>/i);
    const link = linkMatch
      ? (linkMatch[1].startsWith("http") ? linkMatch[1] : `https://www.trevisoinfo.it/${linkMatch[1].replace(/^\//, "")}`)
      : null;

    rawBlocks.push({ text, link });
  }

  // If we got very few <li>, also try extracting <a> links from the page body
  if (rawBlocks.length < 5) {
    // Try content area — look for links that seem like event links
    while ((match = aPattern.exec(html)) !== null) {
      const href = match[1];
      const text = stripHtmlTags(decodeHtmlEntities(match[2])).trim();
      if (!text || text.length < 8) continue;
      // Skip navigation/header links
      if (/^(home|contatti|chi siamo|privacy|cookie)/i.test(text)) continue;
      const link = href.startsWith("http") ? href : `https://www.trevisoinfo.it/${href.replace(/^\//, "")}`;
      rawBlocks.push({ text, link });
    }
  }

  // If still few results, try all paragraphs and divs
  if (rawBlocks.length < 5) {
    while ((match = blockPattern.exec(html)) !== null) {
      const text = stripHtmlTags(decodeHtmlEntities(match[1])).trim();
      if (!text || text.length < 10) continue;
      // Only include texts that look like event names
      if (/sagra|festa|fiera|enogastronomic/i.test(text)) {
        rawBlocks.push({ text, link: null });
      }
    }
  }

  for (const block of rawBlocks) {
    const fullText = block.text;

    // Try to split title from location/date info
    // Common patterns: "Event Name - City", "Event Name a City", "Event Name, City"
    let title = fullText;
    let city = "";
    let descriptionText = fullText;

    // Try to extract city from text
    // Pattern: "...a CityName" or "...– CityName" or "- CityName"
    const cityMatch = fullText.match(/\s+[-–]\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/);
    if (cityMatch) {
      city = cityMatch[1].trim();
      title = fullText.slice(0, fullText.indexOf(cityMatch[0])).trim();
    } else {
      // Try "a CityName" at the end
      const aCityMatch = fullText.match(/\s+a\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/);
      if (aCityMatch) {
        city = aCityMatch[1].trim();
        title = fullText.slice(0, fullText.indexOf(aCityMatch[0])).trim();
      }
    }

    // Try to extract city from parenthetical like "(Castelfranco Veneto)"
    const parenCity = fullText.match(/\(([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\)/);
    if (!city && parenCity) {
      city = parenCity[1].trim();
      title = fullText.replace(parenCity[0], "").trim();
    }

    // If no city found, try to extract from full text using common Treviso province cities
    if (!city) {
      const tvCities = /\b(Treviso|Castelfranco\s+Veneto|Conegliano|Montebelluna|Vittorio\s+Veneto|Oderzo|Mogliano\s+Veneto|Asolo|Valdobbiadene|Casier|Carbonera|Preganziol|Villorba|Roncade|Spresiano|Pieve\s+di\s+Soligo|Follina|Susegana|Arcade|Nervesa\s+della\s+Battaglia|San\s+Biagio\s+di\s+Callalta|Paese|Morgano|Quinto\s+di\s+Treviso|Ponzano\s+Veneto|Silea|Zero\s+Branco|Istrana|Vedelago|Riese\s+Pio\s+X|Altivole|Crocetta\s+del\s+Montello|Giavera\s+del\s+Montello|Volpago\s+del\s+Montello|Maser|Caerano\s+di\s+San\s+Marco|Cornuda|Crespano\s+del\s+Grappa|Borso\s+del\s+Grappa|Possagno|Fonte|San\s+Zenone\s+degli\s+Ezzelini|Loria|Resana|Casale\s+sul\s+Sile|Monastier\s+di\s+Treviso|Salgareda|San\s+Polo\s+di\s+Piave|Orsago|Godega\s+di\s+Sant'Urbano|Colle\s+Umberto|Cappella\s+Maggiore|Sarmede|Revine\s+Lago|Tarzo|Refrontolo|Farra\s+di\s+Soligo|Miane|Moriago\s+della\s+Battaglia|Sernaglia\s+della\s+Battaglia|Vidor|Segusino|Valdobbiadene|Col\s+San\s+Martino)\b/i;
      const tvMatch = fullText.match(tvCities);
      if (tvMatch) {
        city = tvMatch[1].trim();
        // Don't modify title in this case — city is embedded
      }
    }

    // Default city if nothing found
    if (!city) city = "Treviso";

    // Clean up title
    title = title.replace(/\s*[-–:]\s*$/, "").trim();
    if (!title || title.length < 5) continue;

    // Apply filters
    if (isNoiseTitle(title)) {
      console.log(`[trevisoinfo] Skipping noise title: "${title}"`);
      continue;
    }
    if (isNonSagraTitle(title)) {
      console.log(`[trevisoinfo] Skipping non-sagra title: "${title}"`);
      continue;
    }

    const sourceUrl = block.link || baseUrl;
    if (containsPastYear(title, sourceUrl, descriptionText)) {
      console.log(`[trevisoinfo] Skipping past year: "${title}"`);
      continue;
    }

    // Deduplicate
    const normTitle = normalizeText(title);
    if (seenTitles.has(normTitle)) continue;
    seenTitles.add(normTitle);

    // Try to parse dates from the text
    const [startDate, endDate] = parseDateRange(fullText);

    // Skip past events if we have a date
    if (startDate) {
      const eventEnd = endDate || startDate;
      if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
        console.log(`[trevisoinfo] Skipping past event: "${title}" (ends ${eventEnd})`);
        continue;
      }
    }

    const event: NormalizedEvent = {
      title: title.slice(0, 200),
      normalizedTitle: normTitle,
      slug: generateSlug(title, city),
      city,
      province: "TV",
      startDate,
      endDate: endDate || startDate,
      priceInfo: null,
      isFree: null,
      imageUrl: null,
      url: sourceUrl,
      sourceDescription: descriptionText.length > 10 ? descriptionText.slice(0, 2000) : null,
      contentHash: generateContentHash(title, city, startDate),
    };

    events.push(event);
  }

  return events;
}

// --- Main scraping logic ---

const SOURCE_NAME = "trevisoinfo";
const PAGE_URL = "https://www.trevisoinfo.it/feste-sagre-provincia-di-treviso.htm";

async function scrapeTrevisoinfo(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  try {
    const html = await fetchPage(PAGE_URL);
    console.log(`[trevisoinfo] Fetched ${html.length} bytes`);

    const events = parseEvents(html);
    totalFound = events.length;
    console.log(`[trevisoinfo] Parsed ${totalFound} events from HTML`);

    for (const event of events) {
      if (Date.now() - startedAt > 110_000) {
        console.log(`[trevisoinfo] Time budget exceeded, stopping`);
        break;
      }

      const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
      if (result === "inserted") totalInserted++;
      else if (result === "merged") totalMerged++;
      else totalSkipped++;

      console.log(`[trevisoinfo] ${result}: "${event.title}" (${event.city}, ${event.province})`);
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}`);
    console.log(`[trevisoinfo] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[trevisoinfo] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-trevisoinfo] Starting -- trevisoinfo.it static HTML`);

  EdgeRuntime.waitUntil(scrapeTrevisoinfo(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "trevisoinfo",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
