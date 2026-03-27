// =============================================================================
// scrape-insagra — Scrape sagre from insagra.it REST API
// Uses: https://insagra.it/wp-json/insagra/v1/events/search?region=veneto
// Returns structured JSON with GPS coords, dates, organizer info.
// GPS included → status = pending_llm (skip geocoding).
// =============================================================================

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

// --- API response type ---
interface InsagraApiEvent {
  id?: number;
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  data_inizio?: string;
  data_fine?: string;
  ora_inizio?: string;
  ora_fine?: string;
  indirizzo?: string;
  lat?: string | number;
  lng?: string | number;
  organizzatore?: string;
  telefono?: string;
  email?: string;
  sito_web?: string;
  costo_ingresso?: string;
  tipo_evento?: string;
  regione?: string;
  provincia?: string;
  citta?: string;
  featured_image?: string;
  permalink?: string;
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
  // Full province names with "Provincia di" prefix
  "provincia di belluno": "BL", "provincia di padova": "PD",
  "provincia di rovigo": "RO", "provincia di treviso": "TV",
  "provincia di venezia": "VE", "provincia di vicenza": "VI",
  "provincia di verona": "VR",
};

function resolveProvince(rawProvince: string | null | undefined): string | null {
  if (!rawProvince) return null;
  const key = rawProvince.trim().toLowerCase();
  return PROVINCE_NAME_TO_CODE[key] ?? null;
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

  // insagra API provides GPS coords → skip geocoding, go straight to pending_llm
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

// --- API fetch helper ---

async function fetchApiPage(page: number, perPage: number): Promise<InsagraApiEvent[]> {
  const url = `https://insagra.it/wp-json/insagra/v1/events/search?region=veneto&per_page=${perPage}&page=${page}`;
  console.log(`[insagra] Fetching API page ${page}: ${url}`);

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 20_000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Nemovia/1.0; +https://nemovia.it)",
        "Accept": "application/json",
      },
    });
    if (!resp.ok) {
      console.error(`[insagra] API returned ${resp.status} for page ${page}`);
      return [];
    }
    const data = await resp.json();
    // API may return an array directly or wrapped in an object
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.events)) return data.events;
    if (data && Array.isArray(data.results)) return data.results;
    if (data && Array.isArray(data.data)) return data.data;
    console.warn(`[insagra] Unexpected API response shape on page ${page}:`, Object.keys(data));
    return [];
  } catch (err) {
    console.error(`[insagra] Fetch error page ${page}:`, err instanceof Error ? err.message : String(err));
    return [];
  } finally {
    clearTimeout(tid);
  }
}

// --- Parse a single API event into NormalizedEvent ---

function parseApiEvent(raw: InsagraApiEvent): NormalizedEvent | null {
  // Extract and clean title
  const rawTitle = raw.title ?? "";
  const title = decodeHtmlEntities(rawTitle).trim();
  if (!title) return null;

  // Apply noise/non-sagra filters
  if (isNoiseTitle(title)) {
    console.log(`[insagra] Skipping noise title: "${title}"`);
    return null;
  }
  if (isNonSagraTitle(title)) {
    console.log(`[insagra] Skipping non-sagra title: "${title}"`);
    return null;
  }

  // --- Dates ---
  // API returns data_inizio / data_fine (could be YYYY-MM-DD or other formats)
  let startDate: string | null = null;
  let endDate: string | null = null;

  if (raw.data_inizio) {
    const d = new Date(raw.data_inizio);
    if (!isNaN(d.getTime())) startDate = d.toISOString().slice(0, 10);
  }
  if (raw.data_fine) {
    const d = new Date(raw.data_fine);
    if (!isNaN(d.getTime())) endDate = d.toISOString().slice(0, 10);
  }

  // Skip events without start date
  if (!startDate) {
    console.log(`[insagra] Skipping "${title}" -- no start date`);
    return null;
  }

  // Build source URL
  const sourceUrl = raw.permalink
    ? raw.permalink
    : raw.slug
      ? `https://insagra.it/evento/${raw.slug}/`
      : `https://insagra.it/?p=${raw.id ?? 0}`;

  // Apply past year filter
  const excerptText = raw.excerpt ? stripHtmlTags(decodeHtmlEntities(raw.excerpt)) : "";
  if (containsPastYear(title, sourceUrl, excerptText)) {
    console.log(`[insagra] Skipping past year: "${title}"`);
    return null;
  }

  // Skip past events
  const eventEnd = endDate || startDate;
  if (new Date(eventEnd) < new Date(new Date().toISOString().slice(0, 10))) {
    console.log(`[insagra] Skipping past event: "${title}" (ends ${eventEnd})`);
    return null;
  }

  // --- Location ---
  const rawCity = typeof raw.citta === "string" ? raw.citta : (raw.citta?.name ?? raw.citta?.slug ?? String(raw.citta ?? ""));
  const city = decodeHtmlEntities(rawCity.trim());
  const rawProv = typeof raw.provincia === "string" ? raw.provincia : (raw.provincia?.name ?? raw.provincia?.slug ?? String(raw.provincia ?? ""));
  const province = resolveProvince(rawProv);

  if (!city) {
    console.log(`[insagra] Skipping "${title}" -- no city`);
    return null;
  }

  // Validate region -- API is filtered to Veneto but double-check
  if (!province) {
    console.log(`[insagra] Skipping "${title}" -- cannot resolve province "${raw.provincia}"`);
    return null;
  }

  // --- GPS coordinates ---
  let lat: number | null = null;
  let lng: number | null = null;
  if (raw.lat != null && raw.lng != null) {
    lat = typeof raw.lat === "number" ? raw.lat : parseFloat(String(raw.lat));
    lng = typeof raw.lng === "number" ? raw.lng : parseFloat(String(raw.lng));
    if (isNaN(lat) || isNaN(lng)) { lat = null; lng = null; }
    // Validate Veneto bounding box (roughly lat 44.8-46.7, lng 10.6-13.1)
    if (lat != null && lng != null) {
      if (lat < 44.5 || lat > 47.0 || lng < 10.0 || lng > 13.5) {
        console.log(`[insagra] Coords outside Veneto for "${title}": ${lat}, ${lng} -- clearing`);
        lat = null;
        lng = null;
      }
    }
  }

  // --- Description: combine content + organizer info ---
  // Build rich source_description with all structured data
  const descParts: string[] = [];

  // Main content/excerpt
  if (raw.content) {
    const cleanContent = stripHtmlTags(decodeHtmlEntities(raw.content)).trim();
    if (cleanContent.length > 10) {
      descParts.push(cleanContent.length > 1500 ? cleanContent.slice(0, 1500) : cleanContent);
    }
  } else if (excerptText && excerptText.length > 10) {
    descParts.push(excerptText);
  }

  // Address
  if (raw.indirizzo) {
    descParts.push(`Indirizzo: ${decodeHtmlEntities(raw.indirizzo.trim())}`);
  }

  // Time info
  if (raw.ora_inizio) {
    const timeStr = raw.ora_fine
      ? `Orario: ${raw.ora_inizio} - ${raw.ora_fine}`
      : `Orario: dalle ${raw.ora_inizio}`;
    descParts.push(timeStr);
  }

  // Organizer info (phone, email, website)
  if (raw.organizzatore) {
    descParts.push(`Organizzatore: ${decodeHtmlEntities(raw.organizzatore.trim())}`);
  }
  if (raw.telefono) {
    descParts.push(`Telefono: ${raw.telefono.trim()}`);
  }
  if (raw.email) {
    descParts.push(`Email: ${raw.email.trim()}`);
  }
  if (raw.sito_web) {
    descParts.push(`Sito web: ${raw.sito_web.trim()}`);
  }

  let sourceDescription: string | null = descParts.length > 0
    ? descParts.join("\n\n")
    : null;

  if (sourceDescription && sourceDescription.length > 2000) {
    sourceDescription = sourceDescription.slice(0, 2000);
  }

  // --- Price info ---
  let priceInfo: string | null = null;
  let isFree: boolean | null = null;
  if (raw.costo_ingresso) {
    const cost = raw.costo_ingresso.trim().toLowerCase();
    if (cost === "gratuito" || cost === "gratis" || cost === "free" || cost === "0" || cost === "0.00") {
      isFree = true;
      priceInfo = "Ingresso gratuito";
    } else if (cost && cost !== "non specificato" && cost !== "n/a" && cost !== "-") {
      priceInfo = decodeHtmlEntities(raw.costo_ingresso.trim());
    }
  }

  // --- Image ---
  let imageUrl: string | null = null;
  if (raw.featured_image && !isLowQualityUrl(raw.featured_image)) {
    imageUrl = raw.featured_image;
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
    sourceDescription,
    contentHash: generateContentHash(title, city, startDate),
    lat,
    lng,
  };
}

// --- Main scraping logic ---

const PER_PAGE = 50;
const MAX_PAGES = 10; // 50 * 10 = 500 events max, safety cap
const SOURCE_NAME = "insagra";

async function scrapeInsagra(supabase: SupabaseClient): Promise<void> {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  let totalApiEvents = 0;

  try {
    // Paginate through the API
    for (let page = 1; page <= MAX_PAGES; page++) {
      // Time budget check (120s total for edge function)
      if (Date.now() - startedAt > 110_000) {
        console.log(`[insagra] Time budget exceeded at page ${page}, stopping`);
        break;
      }

      const events = await fetchApiPage(page, PER_PAGE);
      console.log(`[insagra] Page ${page}: received ${events.length} events from API`);

      if (events.length === 0) {
        // No more events — end of pagination
        break;
      }

      totalApiEvents += events.length;

      for (const rawEvent of events) {
        const event = parseApiEvent(rawEvent);
        if (!event) continue;

        totalFound++;
        const { result } = await upsertEvent(supabase, event, SOURCE_NAME);
        if (result === "inserted") totalInserted++;
        else if (result === "merged") totalMerged++;
        else totalSkipped++;

        console.log(`[insagra] ${result}: "${event.title}" (${event.city}, ${event.province})${event.lat != null ? " [GPS]" : ""}`);
      }

      // If fewer events than per_page, we reached the last page
      if (events.length < PER_PAGE) {
        console.log(`[insagra] Last page reached (${events.length} < ${PER_PAGE})`);
        break;
      }

      // Small delay between API pages (politeness)
      await new Promise(r => setTimeout(r, 500));
    }

    await logRun(supabase, "success", totalFound, totalInserted, totalMerged, null, startedAt,
      `skipped=${totalSkipped}, api_events=${totalApiEvents}`);
    console.log(`[insagra] Done: api_events=${totalApiEvents}, found=${totalFound}, inserted=${totalInserted}, merged=${totalMerged}, skipped=${totalSkipped}, duration=${Date.now() - startedAt}ms`);
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

  console.log(`[scrape-insagra] Starting -- insagra.it REST API (Veneto)`);

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
