// =============================================================================
// scrape-regioneveneto — Parse official Regione Veneto XLSX with ALL registered
// sagre across the 7 Veneto provinces (~1,123 events).
// Downloads XLSX from regione.veneto.it, parses with SheetJS, maps provinces,
// parses Italian date formats, applies filters, inserts with is_active:false.
// No GPS coords → status: pending_geocode.
// =============================================================================

import * as XLSX from "npm:xlsx@0.18.5";
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
  return normalized.replace(/\s+/g, "-").slice(0, 200);
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

// --- Province mapping ---

const PROVINCE_NAME_TO_CODE: Record<string, string> = {
  belluno: "BL",
  padova: "PD",
  rovigo: "RO",
  treviso: "TV",
  venezia: "VE",
  vicenza: "VI",
  verona: "VR",
  // Handle "Citta Metropolitana di Venezia" etc.
  "citta metropolitana di venezia": "VE",
  "città metropolitana di venezia": "VE",
  // province abbreviations
  bl: "BL", pd: "PD", ro: "RO", tv: "TV",
  ve: "VE", vi: "VI", vr: "VR",
};

function resolveProvince(rawProvince: string | null | undefined): string | null {
  if (!rawProvince) return null;
  const key = rawProvince.trim().toLowerCase();
  // Direct match
  if (PROVINCE_NAME_TO_CODE[key]) return PROVINCE_NAME_TO_CODE[key];
  // Partial match: check if any key is contained in the input
  for (const [name, code] of Object.entries(PROVINCE_NAME_TO_CODE)) {
    if (name.length > 2 && key.includes(name)) return code;
  }
  return null;
}

// --- Italian date parser ---
// Handles formats from Regione Veneto XLSX column 4:
//   "dal 14 al 18/1 giornata intera"
//   "25-26-27/4 dalle 18:00 alle 23:00"
//   "dal 30/5 al 2/6"
//   "1/5"
//   "dal 20 al 22/6"
//   "12-13/7; 19-20/7"
//   "25/4, 1/5, 2/6"
//   "dal 15/8 al 18/8"

function parseItalianDates(
  rawPeriod: string | null | undefined,
  referenceYear: number
): { startDate: string | null; endDate: string | null } {
  if (!rawPeriod || rawPeriod.trim() === "") return { startDate: null, endDate: null };

  const text = rawPeriod
    .trim()
    .toLowerCase()
    // Remove time info for date parsing
    .replace(/\s*(giornata\s+intera|tutto\s+il\s+giorno|orario\s+continuato)/gi, "")
    .replace(/\s*(dalle?\s+\d{1,2}[.:]\d{2}\s*(alle?\s+\d{1,2}[.:]\d{2})?)/gi, "")
    .replace(/\s*(ore?\s+\d{1,2}[.:]\d{2})/gi, "")
    .trim();

  if (!text) return { startDate: null, endDate: null };

  const allDates: Date[] = [];

  // Helper to create date string
  function makeDate(day: number, month: number, year: number = referenceYear): string | null {
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function pushDate(day: number, month: number, year: number = referenceYear) {
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      allDates.push(new Date(year, month - 1, day));
    }
  }

  // Split by semicolons to handle multiple ranges
  const segments = text.split(/[;]/);

  for (const segment of segments) {
    const s = segment.trim();
    if (!s) continue;

    // Pattern: "dal DD al DD/MM" or "dal DD/MM al DD/MM"
    const dalAlMatch = s.match(
      /dal\s+(\d{1,2})(?:\/(\d{1,2}))?\s+al\s+(\d{1,2})\/(\d{1,2})/
    );
    if (dalAlMatch) {
      const startDay = parseInt(dalAlMatch[1]);
      const startMonth = dalAlMatch[2] ? parseInt(dalAlMatch[2]) : parseInt(dalAlMatch[4]);
      const endDay = parseInt(dalAlMatch[3]);
      const endMonth = parseInt(dalAlMatch[4]);
      pushDate(startDay, startMonth);
      pushDate(endDay, endMonth);
      continue;
    }

    // Pattern: "DD-DD-DD/MM" (consecutive days)
    const dashDaysMatch = s.match(/(\d{1,2}(?:-\d{1,2})+)\/(\d{1,2})/);
    if (dashDaysMatch) {
      const days = dashDaysMatch[1].split("-").map(Number);
      const month = parseInt(dashDaysMatch[2]);
      for (const day of days) {
        pushDate(day, month);
      }
      continue;
    }

    // Pattern: "DD/MM, DD/MM, DD/MM" or "DD/MM e DD/MM"
    const fullDateMatches = s.matchAll(/(\d{1,2})\/(\d{1,2})/g);
    let foundFull = false;
    for (const m of fullDateMatches) {
      pushDate(parseInt(m[1]), parseInt(m[2]));
      foundFull = true;
    }
    if (foundFull) continue;

    // Pattern: single "DD/MM"
    const singleMatch = s.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (singleMatch) {
      pushDate(parseInt(singleMatch[1]), parseInt(singleMatch[2]));
      continue;
    }
  }

  if (allDates.length === 0) return { startDate: null, endDate: null };

  // Sort dates
  allDates.sort((a, b) => a.getTime() - b.getTime());

  const earliest = allDates[0];
  const latest = allDates[allDates.length - 1];

  const startDate = makeDate(earliest.getDate(), earliest.getMonth() + 1, earliest.getFullYear());
  const endDate = makeDate(latest.getDate(), latest.getMonth() + 1, latest.getFullYear());

  return { startDate, endDate: endDate || startDate };
}

// --- Extract event title from column 3 ---
// Column 3 contains: "Event Name - Location details" or "Event Name presso Location"
// We want just the event name part.

function extractTitle(raw: string): { title: string; locationDetail: string | null } {
  if (!raw) return { title: "", locationDetail: null };

  let text = raw.trim();

  // Clean up common suffixes like "- Area Feste", "- Piazza Roma", "presso ..."
  // Try splitting on " - " first
  const dashParts = text.split(/\s+-\s+/);
  if (dashParts.length > 1) {
    // The first part is usually the event name
    const title = dashParts[0].trim();
    const locationDetail = dashParts.slice(1).join(" - ").trim();
    return { title, locationDetail };
  }

  // Try splitting on "presso"
  const pressoParts = text.split(/\s+presso\s+/i);
  if (pressoParts.length > 1) {
    return {
      title: pressoParts[0].trim(),
      locationDetail: pressoParts.slice(1).join(" presso ").trim(),
    };
  }

  return { title: text, locationDetail: null };
}

// --- Capitalize city/title nicely ---
function titleCase(s: string): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      // Keep short prepositions lowercase (Italian)
      if (["di", "del", "della", "delle", "dei", "degli", "da", "dal", "dalla",
           "in", "nel", "nella", "con", "su", "sul", "sulla", "per", "tra", "fra",
           "a", "e", "o", "il", "la", "le", "lo", "gli", "i", "un", "una", "uno"].includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    // Ensure first letter is always uppercase
    .replace(/^./, c => c.toUpperCase());
}

// --- Build description from XLSX columns ---
function buildDescription(
  period: string | null,
  activity: string | null,
  organizer: string | null,
  locationDetail: string | null
): string | null {
  const parts: string[] = [];

  if (period) parts.push(`📅 ${period.trim()}`);
  if (locationDetail) parts.push(`📍 ${locationDetail.trim()}`);
  if (activity) parts.push(`🍽️ ${titleCase(activity.trim())}`);
  if (organizer) {
    // Clean organizer — may contain phone, email
    parts.push(`👥 ${organizer.trim()}`);
  }

  if (parts.length === 0) return null;
  return parts.join("\n\n");
}

// --- Extract website URL from column 6 ---
function extractWebsite(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === "" || raw.trim() === "-") return null;
  const text = raw.trim();

  // Try to find a URL
  const urlMatch = text.match(/https?:\/\/[^\s,;]+/i);
  if (urlMatch) return urlMatch[0];

  // Try www. prefix
  const wwwMatch = text.match(/www\.[^\s,;]+/i);
  if (wwwMatch) return `https://${wwwMatch[0]}`;

  // If it looks like a domain
  if (/^[a-zA-Z0-9.-]+\.[a-z]{2,}$/i.test(text)) {
    return `https://${text}`;
  }

  return null;
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
    status:             "pending_geocode",  // No GPS coords from XLSX
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
    console.error(`[regioneveneto] Insert error: ${error.message}`);
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
    source_name:     "regioneveneto",
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- XLSX download helper ---

async function downloadXlsx(url: string, timeoutMs = 30_000): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Nemovia/1.0; +https://nemovia.it)",
        "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*",
      },
    });
    if (!resp.ok) {
      console.error(`[regioneveneto] XLSX download failed: HTTP ${resp.status}`);
      return null;
    }
    return await resp.arrayBuffer();
  } catch (err) {
    console.error(`[regioneveneto] XLSX download error:`, err);
    return null;
  } finally {
    clearTimeout(tid);
  }
}

// --- Main scraping logic ---

const XLSX_URL =
  "https://www.regione.veneto.it/documents/10713/13530434/Calendario+sagre+e+fiere+18.02.2026.xlsx/73de07d0-8b65-4043-a0b9-19d56d509d9b";

const SOURCE_NAME = "regioneveneto";
const SOURCE_URL = "https://www.regione.veneto.it";
const BATCH_SIZE = 50; // Process in batches for DB operations
const CURRENT_YEAR = new Date().getFullYear();

async function scrapeRegioneVeneto(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  let totalFiltered = 0;

  try {
    // Phase 1: Download XLSX
    console.log(`[regioneveneto] Downloading XLSX from regione.veneto.it...`);
    const xlsxData = await downloadXlsx(XLSX_URL);
    if (!xlsxData) {
      await logRun(supabase, "error", 0, 0, 0, "Failed to download XLSX file", startedAt);
      return;
    }
    console.log(`[regioneveneto] Downloaded ${(xlsxData.byteLength / 1024).toFixed(1)} KB`);

    // Phase 2: Parse XLSX with SheetJS
    const workbook = XLSX.read(new Uint8Array(xlsxData), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      await logRun(supabase, "error", 0, 0, 0, "No sheets found in XLSX", startedAt);
      return;
    }

    const sheet = workbook.Sheets[sheetName];
    // Get all rows as arrays (header row + data rows)
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    console.log(`[regioneveneto] Parsed ${rows.length} rows from sheet "${sheetName}"`);

    if (rows.length < 2) {
      await logRun(supabase, "error", 0, 0, 0, `Only ${rows.length} rows in XLSX (expected 1000+)`, startedAt);
      return;
    }

    // Skip header row(s): find first data row
    // The header row typically contains: "Provincia o Citta Metropolitana", "Comune", etc.
    let dataStartRow = 0;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const firstCell = String(rows[i][0] || "").toLowerCase();
      if (firstCell.includes("provincia") || firstCell.includes("citta") || firstCell.includes("città")) {
        dataStartRow = i + 1;
        break;
      }
    }
    if (dataStartRow === 0) {
      // No header found, assume first row is header
      dataStartRow = 1;
    }

    console.log(`[regioneveneto] Data starts at row ${dataStartRow + 1}, total data rows: ${rows.length - dataStartRow}`);

    // Phase 3: Parse all rows into events
    const events: NormalizedEvent[] = [];
    let currentProvince = ""; // Province may be set once and apply to many rows

    for (let i = dataStartRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;

      // Column 0: Provincia — may be empty if same as previous row
      const rawProvince = String(row[0] || "").trim();
      if (rawProvince && rawProvince.length > 1) {
        currentProvince = rawProvince;
      }

      // Column 1: Comune
      const rawCity = String(row[1] || "").trim();
      if (!rawCity || rawCity.length < 2) continue; // Skip empty rows

      // Column 2: Denominazione + luogo
      const rawDenominazione = String(row[2] || "").trim();
      if (!rawDenominazione || rawDenominazione.length < 3) continue;

      // Column 3: Periodo e orario
      const rawPeriod = String(row[3] || "").trim();

      // Column 4: Attivita
      const rawActivity = String(row[4] || "").trim();

      // Column 5: Sito web
      const rawWebsite = String(row[5] || "").trim();

      // Column 6: Organizzatore
      const rawOrganizer = String(row[6] || "").trim();

      // Resolve province
      const province = resolveProvince(currentProvince);
      if (!province) {
        console.log(`[regioneveneto] Row ${i + 1}: unknown province "${currentProvince}", skipping`);
        totalFiltered++;
        continue;
      }

      // Extract title and location detail
      const { title: rawTitle, locationDetail } = extractTitle(rawDenominazione);
      const title = titleCase(decodeHtmlEntities(rawTitle));
      if (!title || title.length < 3) {
        totalFiltered++;
        continue;
      }

      // Apply filters
      if (isNoiseTitle(title)) {
        console.log(`[regioneveneto] Noise title: "${title}"`);
        totalFiltered++;
        continue;
      }
      if (isNonSagraTitle(title)) {
        console.log(`[regioneveneto] Non-sagra title: "${title}"`);
        totalFiltered++;
        continue;
      }

      // Parse dates
      const { startDate, endDate } = parseItalianDates(rawPeriod, CURRENT_YEAR);

      // Check past year in title
      if (containsPastYear(title)) {
        console.log(`[regioneveneto] Past year: "${title}"`);
        totalFiltered++;
        continue;
      }

      // Skip past events (only if we have dates)
      if (startDate) {
        const eventEnd = endDate || startDate;
        if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
          totalFiltered++;
          continue;
        }
      }

      // City name: capitalize nicely
      const city = titleCase(rawCity);

      // Build source URL from website or fallback to regione.veneto.it
      const website = extractWebsite(rawWebsite);
      const sourceUrl = website || SOURCE_URL;

      // Build description from available columns
      const description = buildDescription(rawPeriod, rawActivity, rawOrganizer, locationDetail);

      events.push({
        title: title.slice(0, 200),
        normalizedTitle: normalizeText(title),
        slug: generateSlug(title, city),
        city,
        province,
        startDate,
        endDate: endDate || startDate,
        priceInfo: null,
        isFree: null,
        imageUrl: null, // XLSX has no images
        url: sourceUrl,
        sourceDescription: description,
        contentHash: generateContentHash(title, city, startDate),
      });
    }

    console.log(`[regioneveneto] Parsed ${events.length} valid events (filtered ${totalFiltered})`);
    totalFound = events.length;

    // Phase 4: Upsert in batches
    for (let batch = 0; batch < events.length; batch += BATCH_SIZE) {
      // Time budget check (110s)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[regioneveneto] Time budget exceeded at event ${batch}/${events.length}, stopping`);
        break;
      }

      const batchEvents = events.slice(batch, batch + BATCH_SIZE);
      console.log(`[regioneveneto] Processing batch ${Math.floor(batch / BATCH_SIZE) + 1} (${batch + 1}-${batch + batchEvents.length} of ${events.length})`);

      // Process events in batch concurrently (5 at a time to avoid overwhelming DB)
      const CONCURRENCY = 5;
      for (let j = 0; j < batchEvents.length; j += CONCURRENCY) {
        const chunk = batchEvents.slice(j, j + CONCURRENCY);
        const results = await Promise.allSettled(
          chunk.map(event => upsertEvent(supabase, event, SOURCE_NAME))
        );

        for (const res of results) {
          if (res.status === "fulfilled") {
            const { result } = res.value;
            if (result === "inserted") totalInserted++;
            else if (result === "merged") totalMerged++;
            else totalSkipped++;
          } else {
            console.error(`[regioneveneto] Upsert error:`, res.reason);
            totalSkipped++;
          }
        }
      }
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, filtered=${totalFiltered}`);
    console.log(
      `[regioneveneto] Done: found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, filtered=${totalFiltered}, duration=${Date.now() - startedAt}ms`
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[regioneveneto] Error:`, errorMessage);
    await logRun(supabase, "error", totalFound, totalInserted, totalMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log(`[scrape-regioneveneto] Starting — parsing Regione Veneto XLSX`);

  EdgeRuntime.waitUntil(scrapeRegioneVeneto(supabase));

  return new Response(
    JSON.stringify({
      status: "started",
      source: "regioneveneto",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
