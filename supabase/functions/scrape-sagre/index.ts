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
  const s = raw.toLowerCase().replace(/\s+/g, " ").trim();

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

  // Pattern 2b: Cross-month multi-day range (assosagre format)
  // e.g. "29-30-31 maggio 1-2 giugno 2026" or "16-17-18-22-23-24-25-29-30-31 ottobre 1 novembre 2026"
  // Strategy: find ALL "days month" segments + trailing year, take first day of first segment as start,
  // last day of last segment as end.
  const segments: { days: number[]; month: number }[] = [];
  let year: number | null = null;

  // Extract year from end of string
  const yearMatch = s.match(/(\d{4})\s*$/);
  if (yearMatch) year = +yearMatch[1];

  // Find all "D[-D[-D...]] MonthName" segments
  const segRegex = /([\d]+(?:-[\d]+)*)\s+([a-z]+)/g;
  let segMatch: RegExpExecArray | null;
  while ((segMatch = segRegex.exec(s)) !== null) {
    const monthNum = ITALIAN_MONTHS[segMatch[2]];
    if (!monthNum) continue;
    const days = segMatch[1].split("-").map(Number).filter((d) => d > 0 && d <= 31);
    if (days.length > 0) {
      segments.push({ days, month: monthNum });
    }
  }

  if (segments.length > 0 && year) {
    const firstSeg = segments[0];
    const lastSeg = segments[segments.length - 1];
    const startDay = Math.min(...firstSeg.days);
    const endDay = Math.max(...lastSeg.days);
    return {
      start: toIso(startDay, firstSeg.month, year),
      end: toIso(endDay, lastSeg.month, year),
    };
  }

  // Pattern 2: DD[-DD] MonthName YYYY (e.g. "24 Aprile 2026", "24-26 Aprile 2026")
  const wordMatch = s.match(/(\d{1,2})(?:-(\d{1,2}))?\s+([a-z]+)\s+(\d{4})/);
  if (wordMatch) {
    const monthNum = ITALIAN_MONTHS[wordMatch[3]];
    if (monthNum) {
      const startDay = +wordMatch[1];
      const endDay = wordMatch[2] ? +wordMatch[2] : startDay;
      const yr = +wordMatch[4];
      return {
        start: toIso(startDay, monthNum, yr),
        end: toIso(endDay, monthNum, yr),
      };
    }
  }

  return { start: null, end: null };
}

// --- Section 2b: Noise title detection ---
// Inline copy from src/lib/scraper/filters.ts (Deno cannot import from src/).
// Keep in sync with the canonical source. Tests live at src/lib/scraper/__tests__/filters.test.ts
function isNoiseTitle(title: string): boolean {
  if (!title || title.length < 5 || title.length > 150) return true;
  const t = title.toLowerCase();

  // Calendar/navigation noise (original patterns from v1.1)
  if (/calendario\s.*(mensile|regioni|italian)/i.test(t)) return true;
  if (/cookie|privacy\s*policy|termini\s*(e\s*)?condizion/i.test(t))
    return true;
  if (/cerca\s+sagr|ricerca\s+event/i.test(t)) return true;
  if (/^(menu|navigazione|home)\b/i.test(t)) return true;
  if (/^[\d\s\-\/\.]+$/.test(title.trim())) return true;
  if (/tutte le sagre|elenco sagre|lista sagre/i.test(t)) return true;
  if (/gennaio.*dicembre|dicembre.*gennaio/i.test(t)) return true;

  // NEW: Expanded calendar spam -- "calendario" combined with event keywords
  // but NOT standalone "calendario" (avoids false positives like
  // "Sagra della Polenta - Calendario 2026")
  if (/calendario\b/i.test(t) && /\beventi\b|\bsagre\b|\bfeste\b/i.test(t))
    return true;

  // NEW: Program/schedule spam
  if (/programma\s+(completo|mensile|settimanale)/i.test(t)) return true;

  // NEW: "Discover all" / "See all" CTAs
  if (/scopri\s+tutt[ei]|vedi\s+tutt[ei]/i.test(t)) return true;

  // NEW: Newsletter/signup noise
  if (/newsletter|iscriviti|registrati/i.test(t)) return true;

  // Aggregator/article titles — NOT a specific sagra
  // "Sagre ed Eventi Veneto", "Eventi enogastronomici di aprile", "Le sagre di agosto"
  if (/\b(sagre|eventi|feste|fiere|festival)\s+(ed?|e|del|della|dei|in|nel)\s+(eventi|sagre|feste|fiere|veneto|italia)/i.test(t)) return true;
  if (/\beventi\s+enogastronomic/i.test(t)) return true;
  if (/\b(le\s+sagre|le\s+feste|gli\s+eventi)\s+(di|del|della|da|vicino|più)\b/i.test(t)) return true;
  if (/\b(cosa\s+fare|dove\s+andare|weekend|week\s*end)\b/i.test(t)) return true;

  return false;
}

// --- Section 2b: Non-sagra title filter ---
// Inline copy from src/lib/scraper/filters.ts (Deno cannot import from src/).
// Keep in sync with the canonical source. Tests live at src/lib/scraper/__tests__/filters.test.ts
function isNonSagraTitle(title: string): boolean {
  if (!title || title.length === 0) return false;
  const t = title.toLowerCase();

  // Whitelist: if title contains SPECIFIC sagra/food keywords, don't reject.
  // But PLURAL forms ("sagre", "feste", "eventi") are often article/listing titles,
  // so only whitelist SINGULAR forms or specific food items.
  if (
    /\b(sagra|festa\s+d[ei]l|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|birra|griglia)/i.test(
      t
    )
  ) {
    return false;
  }

  // Non-sagra patterns: reject if the primary subject is a non-sagra event
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
    /\brassegna\b/i.test(t)
  ) {
    return true;
  }

  return false;
}

// --- Section 2c: Date quality filters ---
// Inline copies from src/lib/scraper/filters.ts (Deno cannot import from src/).
// Keep in sync with the canonical source. Tests live at src/lib/scraper/__tests__/filters.test.ts

function isCalendarDateRange(
  startDate: string | null,
  endDate: string | null
): boolean {
  if (!startDate || !endDate) return false;

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Full-month range: starts on the 1st, ends on the 28th or later
  if (start.getUTCDate() === 1 && end.getUTCDate() >= 28) {
    return true;
  }

  return false;
}

function isExcessiveDuration(
  startDate: string | null,
  endDate: string | null,
  maxDays: number = 7
): boolean {
  if (!startDate || !endDate) return false;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays > maxDays;
}

function isPastYearEvent(
  startDate: string | null,
  endDate: string | null
): boolean {
  const currentYear = new Date().getFullYear();

  if (startDate) {
    const startYear = new Date(startDate).getFullYear();
    if (startYear < currentYear) return true;
  }

  if (endDate) {
    const endYear = new Date(endDate).getFullYear();
    if (endYear < currentYear) return true;
  }

  return false;
}

// --- Section 2d: Image URL upgrade + low-quality detection ---
// Inline copy from src/lib/scraper/filters.ts + src/lib/fallback-images.ts
// (Deno cannot import from src/). Keep in sync with canonical sources.
// Tests live at src/lib/scraper/__tests__/filters.test.ts

const BAD_IMAGE_PATTERNS: RegExp[] = [
  // Tracking pixels and spacer GIFs
  /spacer\.(gif|png)/i,
  /pixel\.(gif|png)/i,
  /1x1\.(gif|png|jpg)/i,
  /blank\.(gif|png|jpg)/i,
  /transparent\.(gif|png)/i,

  // Common placeholder / default image filenames
  /no[-_]?image/i,
  /no[-_]?photo/i,
  /no[-_]?pic/i,
  /default[-_]?(image|img|photo|thumb)/i,
  /placeholder/i,
  /coming[-_]?soon/i,
  /image[-_]?not[-_]?found/i,
  /missing[-_]?(image|photo)/i,

  // Site logos and branding (not event photos)
  /\blogo[-_]?(sito|site|header|footer|main)?\b.*\.(png|jpg|svg|gif|webp)$/i,
  /\bfavicon\b/i,
  /\bicon[-_]?\d*\.(png|ico|svg)/i,

  // WordPress placeholder patterns
  /wp-content\/plugins\/.*placeholder/i,
  /woocommerce-placeholder/i,

  // Data URIs
  /^data:image/i,

  // Very small dimension indicators in URL
  /[?&]w=([1-9]\d?|1[0-4]\d|150)(&|$)/,
  /[?&]h=([1-9]\d?|1[0-4]\d|150)(&|$)/,
  /-(\d{1,2}|1[0-4]\d|150)x(\d{1,2}|1[0-4]\d|150)\.\w+$/,
];

function isLowQualityUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  for (const pattern of BAD_IMAGE_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  return false;
}

function tryUpgradeImageUrl(
  imageUrl: string | null,
  sourceName: string
): string | null {
  if (!imageUrl || imageUrl === "") return null;

  let upgraded: string;

  switch (sourceName) {
    case "sagritaly":
      // Strip WordPress thumbnail suffix: image-150x150.jpg -> image.jpg
      upgraded = imageUrl.replace(/-\d+x\d+(\.\w+)$/, "$1");
      break;

    case "solosagre":
      // Remove w, h, resize query params
      try {
        const url = new URL(imageUrl);
        url.searchParams.delete("w");
        url.searchParams.delete("h");
        url.searchParams.delete("resize");
        upgraded = url.toString();
      } catch {
        upgraded = imageUrl;
      }
      break;

    default:
      upgraded = imageUrl;
  }

  // After upgrading, check if the URL is a known bad pattern
  if (isLowQualityUrl(upgraded)) return null;

  return upgraded;
}

// --- Section 2e: Detail page content extraction ---
// Extracts description, menu, and orari from individual event detail pages.

interface DetailContent {
  description: string | null;
  menu: string | null;
  orari: string | null;
}

function extractAssosagreDetail($: cheerio.CheerioAPI): DetailContent {
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  // Menu: match food category headers and their content
  let menu: string | null = null;
  const menuMatch = bodyText.match(
    /((?:Primi|Antipasti|Secondi|Contorni|Dolci|Grigliate|Bevande)[\s\S]*?)(?=Apertura|Prenotaz|Info|Contatt|$)/i
  );
  if (menuMatch) {
    menu = menuMatch[1].trim().slice(0, 2000) || null;
  }

  // Orari: match opening hours patterns
  let orari: string | null = null;
  const orariMatch = bodyText.match(
    /((?:Apertura\s+ore|Orari|Orario)[\s\S]*?)(?=\n\n|Prenotaz|Menu|Info|$)/i
  );
  if (orariMatch) {
    orari = orariMatch[1].trim().slice(0, 500) || null;
  }

  // Description: match event intro patterns
  let description: string | null = null;
  const descMatch = bodyText.match(
    /((?:La sagra|L'evento|Vi aspettiamo|Torna|Edizione)[\s\S]*?)(?=Primi:|Apertura|Menu|Info|$)/i
  );
  if (descMatch) {
    description = descMatch[1].trim().slice(0, 1000) || null;
  }

  return { description, menu, orari };
}

function extractVenetoInFestaDetail($: cheerio.CheerioAPI): DetailContent {
  // Description: longest text node from paragraphs and table cells
  let description: string | null = null;
  const textNodes: string[] = [];
  $("div p, div td").each((_i: number, el: cheerio.Element) => {
    const text = $(el).text().trim();
    if (text.length > 50) {
      textNodes.push(text);
    }
  });
  if (textNodes.length > 0) {
    textNodes.sort((a, b) => b.length - a.length);
    description = textNodes[0].slice(0, 1000);
  }

  // Orari: find td cells with time patterns and relevant keywords
  let orari: string | null = null;
  $("td").each((_i: number, el: cheerio.Element) => {
    if (orari) return; // take first match
    const text = $(el).text().trim();
    if (/\b\d{1,2}:\d{2}\b/.test(text) && /dalle|ore|apertura/i.test(text)) {
      orari = text.slice(0, 500);
    }
  });

  // Menu: venetoinfesta embeds food info in description, not structured separately
  return { description, menu: null, orari };
}

function extractItinerariDetail($: cheerio.CheerioAPI): DetailContent {
  // Description: from .FullNews div, fallback to .entry-content
  let description: string | null = null;
  const fullNewsText = $("div.FullNews").first().text().trim();
  if (fullNewsText) {
    description = fullNewsText.slice(0, 1000);
  } else {
    const entryText = $("div.entry-content").first().text().trim();
    if (entryText) {
      description = entryText.slice(0, 1000);
    }
  }

  // Menu: look for <ul> lists inside .FullNews
  let menu: string | null = null;
  const menuUl = $("div.FullNews ul").first();
  if (menuUl.length > 0) {
    const items: string[] = [];
    menuUl.find("li").each((_i: number, el: cheerio.Element) => {
      items.push($(el).text().trim());
    });
    if (items.length > 0) {
      menu = items.join("\n").slice(0, 2000);
    }
  }

  // Orari: look for time patterns in the page text
  let orari: string | null = null;
  const pageText = $("body").text();
  const orariMatch = pageText.match(
    /(?:ore|dalle|apertura)\s*:?\s*\d{1,2}[.:]\d{2}/i
  );
  if (orariMatch) {
    // Extract the surrounding context (up to 200 chars around the match)
    const idx = pageText.indexOf(orariMatch[0]);
    const start = Math.max(0, idx - 50);
    const end = Math.min(pageText.length, idx + orariMatch[0].length + 150);
    orari = pageText.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 500);
  }

  return { description, menu, orari };
}

// TODO: Verify selectors when sagritaly.com is reachable
function extractSagritalyDetail($: cheerio.CheerioAPI): DetailContent {
  let description: string | null = null;
  const entryText = $(".entry-content").first().text().trim();
  if (entryText) {
    description = entryText.slice(0, 1000);
  }
  return { description, menu: null, orari: null };
}

// TODO: Verify selectors when solosagre.it detail pages are accessible
function extractSolosagreDetail($: cheerio.CheerioAPI): DetailContent {
  let description: string | null = null;
  const articleText = $("article").first().text().trim();
  if (articleText) {
    description = articleText.slice(0, 1000);
  } else {
    const entryText = $(".entry-content").first().text().trim();
    if (entryText) {
      description = entryText.slice(0, 1000);
    }
  }
  return { description, menu: null, orari: null };
}

function extractDetailContent($: cheerio.CheerioAPI, sourceName: string): DetailContent {
  switch (sourceName) {
    case "assosagre": return extractAssosagreDetail($);
    case "venetoinfesta": return extractVenetoInFestaDetail($);
    case "itinerarinelgusto": return extractItinerariDetail($);
    case "sagritaly": return extractSagritalyDetail($);
    case "solosagre": return extractSolosagreDetail($);
    default: return { description: null, menu: null, orari: null };
  }
}

// --- Section 2f: Detail page scraping orchestration ---

async function scrapeDetailPages(
  supabase: SupabaseClient,
  sourceName: string,
  eventUrls: Array<{ id: string; url: string }>
): Promise<{ scraped: number; updated: number }> {
  console.log(`[scrapeDetailPages] ${sourceName}: processing ${eventUrls.length} URLs (max 10)`);

  let scraped = 0;
  let updated = 0;
  const MAX_DETAIL_PAGES = 10;

  for (const { id, url } of eventUrls.slice(0, MAX_DETAIL_PAGES)) {
    const html = await fetchWithTimeout(url, 10_000);
    if (!html) continue;
    scraped++;

    const $ = cheerio.load(html);
    const detail = extractDetailContent($, sourceName);

    // Only update if we extracted at least one non-empty field
    const updates: Record<string, string | undefined> = {};
    if (detail.description) updates.source_description = detail.description;
    if (detail.menu) updates.menu_text = detail.menu;
    if (detail.orari) updates.orari_text = detail.orari;

    if (Object.keys(updates).length > 0) {
      // Only update fields that are currently NULL (don't overwrite existing content)
      const { data: existing } = await supabase
        .from("sagre")
        .select("source_description, menu_text, orari_text")
        .eq("id", id)
        .single();

      const finalUpdates: Record<string, string> = {};
      if (updates.source_description && !existing?.source_description) {
        finalUpdates.source_description = updates.source_description;
      }
      if (updates.menu_text && !existing?.menu_text) {
        finalUpdates.menu_text = updates.menu_text;
      }
      if (updates.orari_text && !existing?.orari_text) {
        finalUpdates.orari_text = updates.orari_text;
      }

      if (Object.keys(finalUpdates).length > 0) {
        await supabase.from("sagre").update({
          ...finalUpdates,
          updated_at: new Date().toISOString(),
        }).eq("id", id);
        updated++;
      }
    }

    // Politeness delay between detail page fetches
    await new Promise(r => setTimeout(r, 1500));
  }

  return { scraped, updated };
}

async function getEventsNeedingDetails(
  supabase: SupabaseClient,
  sourceName: string,
  limit: number = 10
): Promise<Array<{ id: string; url: string }>> {
  const { data } = await supabase
    .from("sagre")
    .select("id, source_url")
    .eq("is_active", true)
    .not("source_url", "is", null)
    .is("source_description", null)
    .contains("sources", [sourceName])
    .limit(limit);

  return (data ?? [])
    .filter((r: { source_url: string | null }) => r.source_url != null)
    .map((r: { id: string; source_url: string }) => ({ id: r.id, url: r.source_url }));
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

// --- Section 3b: City extraction fallback ---
// When selector_city is null, try to extract city from the full text block.
// Handles patterns like "Veneto Cittadella (PD)", "Veneto San Donà di Piave (VE)"
function parseCityFromText(text: string): string {
  // Pattern: <Region> <City> (<Province>)
  const regionCity = text.match(
    /(?:Veneto|Lombardia|Piemonte|Emilia[\s-]Romagna|Trentino|Friuli)\s+(.+?)\s*\([A-Z]{2}\)/i
  );
  if (regionCity) return regionCity[1].trim();

  // Fallback: any "CityName (XX)" where XX is a 2-letter province
  const cityProv = text.match(/([A-ZÀ-Ú][a-zà-ú]+(?:\s+[a-zà-ú]+)*(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*\([A-Z]{2}\)/);
  if (cityProv) return cityProv[1].trim();

  // Fallback: "CityName - XX" where XX is a 2-letter province (venetoinfesta format)
  const cityDash = text.match(/([A-ZÀ-Ú][a-zà-ú]+(?:\s+[a-zà-ú]+)*(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*-\s*[A-Z]{2}\b/);
  if (cityDash) return cityDash[1].trim();

  return "";
}

// --- Section 4: Scraping logic ---
function buildPageUrl(source: ScraperSource, page: number): string {
  if (page === 1) return source.base_url;
  if (source.url_pattern) {
    // Offset-based pagination for itinerarinelgusto (pages_size=15, offset=0,15,30...)
    if (source.name === "itinerarinelgusto" && source.url_pattern.includes("{n}")) {
      return source.base_url + source.url_pattern.replace("{n}", String((page - 1) * 15));
    }
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

  // --- venetoinfesta-specific extraction ---
  // Events are in div.box_evento with structured date spans and category/city in p.comments
  if (source.name === "venetoinfesta") {
    const title = $el.find("h2.tit a").first().text().trim();

    // Date: div.data_singola has span.month, span.day, span.year
    //        div.data_doppia has start (span.month/day/year) and end (span.month_to/day_to/year_to)
    let dateText = "";
    const $dataSingola = $el.find("div.data_singola");
    const $dataDoppia = $el.find("div.data_doppia");
    if ($dataDoppia.length > 0) {
      // Date range: reconstruct as "DD/MM/YYYY al DD/MM/YYYY" for parseItalianDateRange
      const d1 = $dataDoppia.find("span.day").first().text().trim();
      const m1 = $dataDoppia.find("span.month").first().text().trim();
      const y1 = $dataDoppia.find("span.year").first().text().trim();
      const d2 = $dataDoppia.find("span.day_to").first().text().trim();
      const m2 = $dataDoppia.find("span.month_to").first().text().trim();
      const y2 = $dataDoppia.find("span.year_to").first().text().trim();
      // Convert month abbreviation to number
      const m1Num = ITALIAN_MONTHS[m1.toLowerCase()] ?? 0;
      const m2Num = ITALIAN_MONTHS[m2.toLowerCase()] ?? 0;
      dateText = `${d1}/${m1Num}/${y1} al ${d2}/${m2Num}/${y2}`;
    } else if ($dataSingola.length > 0) {
      const d = $dataSingola.find("span.day").first().text().trim();
      const m = $dataSingola.find("span.month").first().text().trim();
      const y = $dataSingola.find("span.year").first().text().trim();
      const mNum = ITALIAN_MONTHS[m.toLowerCase()] ?? 0;
      dateText = `${d}/${mNum}/${y}`;
    }

    // City: from p.comments a[href*="/eventi/comune/"] — text format "CityName - XX"
    const cityRaw = $el.find('p.comments a[href*="/eventi/comune/"]').first().text().trim();
    // Extract just the city name, stripping " - XX" province suffix
    const cityMatch = cityRaw.match(/^(.+?)\s*-\s*[A-Z]{2}$/);
    const city = cityMatch ? cityMatch[1].trim() : cityRaw;

    // URL: from the h2 title link
    let url = $el.find("h2.tit a").first().attr("href") ?? null;
    if (url && !url.startsWith("http")) {
      try { url = new URL(url, source.base_url).href; } catch { /* */ }
    }

    // Image
    let image = $el.find("img.img_evt_list").first().attr("src") ?? null;
    if (image && !image.startsWith("http")) {
      try { image = new URL(image, source.base_url).href; } catch { /* */ }
    }

    return { title, dateText, city, price: null, url, image };
  }

  // --- sagritaly-specific extraction ---
  // WordPress/WooCommerce site with structured custom fields for dates and location
  if (source.name === "sagritaly") {
    const $el = $(el);

    // Title: h5 on active events page, h3 on passati page
    const title = $el.find("h5.post_title a, h3.post_title a").first().text().trim();

    // Dates: custom fields with class containing data_inizio / data_fine
    // Format is DD/MM/YYYY which parseItalianDateRange() handles via Pattern 1
    const startDateRaw = $el.find("div[class*='data_inizio'] span.w-post-elm-value").first().text().trim();
    const endDateRaw = $el.find("div[class*='data_fine'] span.w-post-elm-value").first().text().trim();
    const dateText = endDateRaw ? `${startDateRaw} al ${endDateRaw}` : startDateRaw;

    // City: custom field with class containing luogo_evento
    const city = $el.find("div[class*='luogo_evento'] span.w-post-elm-value").first().text().trim();

    // URL: from the title link (sagritaly.com detail page)
    let url = $el.find("h5.post_title a, h3.post_title a").first().attr("href") ?? null;
    if (url && !url.startsWith("http")) {
      try { url = new URL(url, source.base_url).href; } catch { /* */ }
    }

    // Image: WordPress post thumbnail
    let image = $el.find("img.wp-post-image").first().attr("src") ?? null;
    if (image && !image.startsWith("http")) {
      try { image = new URL(image, source.base_url).href; } catch { /* */ }
    }

    return { title, dateText, city, price: null, url, image };
  }

  // --- itinerarinelgusto-specific extraction ---
  // Server-rendered cards with Schema.org microdata (schema.org/Event)
  // Selectors verified from live HTML: .row.tile.post.pad containers,
  // h2.events a for title/URL, meta[itemprop] for dates/image, h3.event-header a for city
  if (source.name === "itinerarinelgusto") {
    const title = $el.find("h2.events a").first().text().trim();

    // Dates: Schema.org meta tags provide clean ISO datetimes (e.g. "2026-03-08T17:00:00")
    const startIso = $el.find('meta[itemprop="startDate"]').first().attr("content") ?? "";
    const endIso = $el.find('meta[itemprop="endDate"]').first().attr("content") ?? "";
    // Extract YYYY-MM-DD from ISO datetime for parseItalianDateRange compatibility
    const dateText = startIso && endIso
      ? `${startIso.slice(0, 10).split("-").reverse().join("/")} al ${endIso.slice(0, 10).split("-").reverse().join("/")}`
      : startIso ? startIso.slice(0, 10).split("-").reverse().join("/")
      : $el.find("span.eventi-data").first().text().trim();

    // City: from h3.event-header a (e.g. "Roncade", "Provincia di Treviso")
    const cityRaw = $el.find("h3.event-header a").first().text().trim();
    // Strip "Provincia di " prefix if present
    const city = cityRaw.replace(/^Provincia di\s+/i, "").trim();

    // URL: from the title link
    let url = $el.find("h2.events a").first().attr("href") ?? null;
    if (url && !url.startsWith("http")) {
      try { url = new URL(url, source.base_url).href; } catch { /* */ }
    }

    // Image: prefer full-size from Schema.org meta, fallback to figure img
    let image = $el.find('meta[itemprop="image"]').first().attr("content") ?? null;
    if (!image) {
      image = $el.find("figure.box-pic img").first().attr("src") ?? null;
    }
    if (image && !image.startsWith("http")) {
      try { image = new URL(image, source.base_url).href; } catch { /* */ }
    }

    return { title, dateText, city, price: null, url, image };
  }

  // --- Generic extraction for other sources ---
  const title = $el.find(source.selector_title).first().text().trim();
  const dateText = source.selector_start_date
    ? $el.find(source.selector_start_date).first().text().trim()
    : $el.text().trim();
  const city = source.selector_city
    ? $el.find(source.selector_city).first().text().trim()
    : parseCityFromText($el.text());
  const price = source.selector_price
    ? $el.find(source.selector_price).first().text().trim() || null
    : null;

  let url: string | null = null;
  if (source.selector_url === null && $el.is("a")) {
    url = $el.attr("href") ?? null;
  } else if (source.selector_url) {
    // First try finding within the element
    url = $el.find(source.selector_url).first().attr("href") ?? null;
    // If not found, check if a parent matches the selector (e.g. assosagre wraps .datiSagra in an <a>)
    if (!url) {
      url = $el.closest(source.selector_url).attr("href") ?? null;
    }
  }

  // Resolve relative URLs against the source's base_url
  if (url && !url.startsWith("http")) {
    try {
      url = new URL(url, source.base_url).href;
    } catch {
      // leave as-is if URL parsing fails
    }
  }

  let image = source.selector_image
    ? $el.find(source.selector_image).first().attr("src") ?? null
    : null;

  // Resolve relative image URLs against the source's base_url
  if (image && !image.startsWith("http")) {
    try {
      image = new URL(image, source.base_url).href;
    } catch {
      // leave as-is if URL parsing fails
    }
  }

  return { title, dateText, city, price, url, image };
}

function normalizeRawEvent(raw: RawEventData, sourceName: string): NormalizedEvent {
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
    imageUrl: tryUpgradeImageUrl(raw.image, sourceName),
    url: raw.url,
    contentHash: generateContentHash(raw.title, raw.city, parsedDates.start),
  };
}

async function upsertEvent(
  supabase: SupabaseClient,
  event: NormalizedEvent,
  sourceName: string
): Promise<{ result: "inserted" | "merged" | "skipped"; id?: string }> {
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
    if (existing.sources?.includes(sourceName)) return { result: "skipped" };

    // Enrich missing fields + add provenance
    await supabase.from("sagre").update({
      image_url:  existing.image_url  ?? event.imageUrl,
      price_info: existing.price_info ?? event.priceInfo,
      is_free:    existing.is_free    ?? event.isFree,
      sources:    [...(existing.sources ?? []), sourceName],
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
    return { result: "merged", id: existing.id };
  }

  // Insert new record
  const { data: insertData, error } = await supabase.from("sagre").insert({
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
    is_active:     false,
    status:        "pending_geocode",
    content_hash:  event.contentHash,
  }).select("id").single();

  if (error) {
    // Slug conflict: regenerate with timestamp suffix
    if (error.code === "23505") {
      const { data: retryData } = await supabase.from("sagre").insert({
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
        is_active:     false,
        status:        "pending_geocode",
        content_hash:  event.contentHash + Date.now().toString(36),
      }).select("id").single();
      return { result: "inserted", id: retryData?.id };
    }
  }
  return { result: "inserted", id: insertData?.id };
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
  // For custom scrapers with non-UUID synthetic IDs, set source_id to null
  const isCustomSource = source.id.startsWith("custom-");
  await supabase.from("scrape_logs").insert({
    source_id:       isCustomSource ? null : source.id,
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
    const newEventUrls: Array<{ id: string; url: string }> = [];

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

        // Skip items with no title (city is optional — geocoding can fill it later)
        if (!raw.title) continue;

        // Skip noise entries (calendar pages, navigation text, generic non-event strings)
        if (isNoiseTitle(raw.title)) continue;

        // Skip non-sagra events (standalone concerts, markets, theatre, etc.)
        if (isNonSagraTitle(raw.title)) continue;

        const normalized = normalizeRawEvent(raw, source.name);

        // Date quality gates (Phase 14: DQ-02, DQ-03, DQ-04)
        if (isCalendarDateRange(normalized.startDate, normalized.endDate)) continue;
        if (isExcessiveDuration(normalized.startDate, normalized.endDate, 7)) continue;
        if (isPastYearEvent(normalized.startDate, normalized.endDate)) continue;

        const { result, id: eventId } = await upsertEvent(supabase, normalized, source.name);

        eventsFound++;
        if (result === "inserted") {
          eventsInserted++;
          if (eventId && normalized.url) {
            newEventUrls.push({ id: eventId, url: normalized.url });
          }
        }
        else if (result === "merged") eventsMerged++;
      }

      // Politeness delay between pages
      if (page < source.max_pages) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // Detail page scraping: process newly inserted events + backfill existing
    const backfillUrls = await getEventsNeedingDetails(
      supabase, source.name, Math.max(0, 10 - newEventUrls.length)
    );
    const allDetailUrls = [...newEventUrls, ...backfillUrls].slice(0, 10);

    if (allDetailUrls.length > 0) {
      const { scraped, updated } = await scrapeDetailPages(supabase, source.name, allDetailUrls);
      console.log(`[scrapeSource] ${source.name}: detail pages scraped=${scraped}, updated=${updated}`);
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
// NOTE: Custom scrapers (sagretoday, trovasagre, sagriamo) have been moved to
// dedicated edge functions: scrape-sagretoday, scrape-trovasagre, scrape-sagriamo.
// Each runs on its own pg_cron schedule for better timeout management.
async function runPipeline(supabase: SupabaseClient) {
  // Run existing DB-driven scrapers (assosagre, venetoinfesta, solosagre, sagritaly, eventiesagre, itinerarinelgusto)
  // Custom scrapers (sagretoday, trovasagre, sagriamo) run as separate edge functions.
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

  console.log("[runPipeline] All DB-driven scrapers complete.");
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
