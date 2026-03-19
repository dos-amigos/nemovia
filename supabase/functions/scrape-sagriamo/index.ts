import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// --- Type definitions ---
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
  province?: string | null;
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

function isNoiseTitle(title: string): boolean {
  if (!title || title.length < 5 || title.length > 150) return true;
  const t = title.toLowerCase();
  if (/calendario\s.*(mensile|regioni|italian)/i.test(t)) return true;
  if (/cookie|privacy\s*policy|termini\s*(e\s*)?condizion/i.test(t)) return true;
  if (/cerca\s+sagr|ricerca\s+event/i.test(t)) return true;
  if (/^(menu|navigazione|home)\b/i.test(t)) return true;
  if (/^[\d\s\-\/\.]+$/.test(title.trim())) return true;
  if (/tutte le sagre|elenco sagre|lista sagre/i.test(t)) return true;
  if (/gennaio.*dicembre|dicembre.*gennaio/i.test(t)) return true;
  if (/calendario\b/i.test(t) && /\beventi\b|\bsagre\b|\bfeste\b/i.test(t)) return true;
  if (/programma\s+(completo|mensile|settimanale)/i.test(t)) return true;
  if (/scopri\s+tutt[ei]|vedi\s+tutt[ei]/i.test(t)) return true;
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
    /\brassegna\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

// --- Date quality filters ---

function isCalendarDateRange(startDate: string | null, endDate: string | null): boolean {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start.getUTCDate() === 1 && end.getUTCDate() >= 28) return true;
  return false;
}

function isExcessiveDuration(startDate: string | null, endDate: string | null, maxDays: number = 7): boolean {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > maxDays;
}

function isPastYearEvent(startDate: string | null, endDate: string | null): boolean {
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

// --- Image quality filters ---

const BAD_IMAGE_PATTERNS: RegExp[] = [
  /spacer\.(gif|png)/i, /pixel\.(gif|png)/i, /1x1\.(gif|png|jpg)/i,
  /blank\.(gif|png|jpg)/i, /transparent\.(gif|png)/i,
  /no[-_]?image/i, /no[-_]?photo/i, /no[-_]?pic/i,
  /default[-_]?(image|img|photo|thumb)/i, /placeholder/i,
  /coming[-_]?soon/i, /image[-_]?not[-_]?found/i, /missing[-_]?(image|photo)/i,
  /\blogo[-_]?(sito|site|header|footer|main)?\b.*\.(png|jpg|svg|gif|webp)$/i,
  /\bfavicon\b/i, /\bicon[-_]?\d*\.(png|ico|svg)/i,
  /wp-content\/plugins\/.*placeholder/i, /woocommerce-placeholder/i,
  /^data:image/i,
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

function tryUpgradeImageUrl(imageUrl: string | null, _sourceName: string): string | null {
  if (!imageUrl || imageUrl === "") return null;
  if (isLowQualityUrl(imageUrl)) return null;
  return imageUrl;
}

// --- Province helpers ---

const VENETO_PROVINCE_CODES = ["BL", "PD", "RO", "TV", "VE", "VI", "VR"];

const PROVINCE_NAME_TO_CODE: Record<string, string> = {
  belluno: "BL", padova: "PD", rovigo: "RO", treviso: "TV",
  venezia: "VE", vicenza: "VI", verona: "VR",
};

function normalizeProvinceCode(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return PROVINCE_NAME_TO_CODE[trimmed.toLowerCase()] || trimmed.toUpperCase();
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

  const status = event.province ? "pending_llm" : "pending_geocode";

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
    status,
    content_hash:  event.contentHash,
    ...(event.province ? { province: event.province } : {}),
  }).select("id").single();

  if (error) {
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
        status,
        content_hash:  event.contentHash + Date.now().toString(36),
        ...(event.province ? { province: event.province } : {}),
      }).select("id").single();
      return { result: "inserted", id: retryData?.id };
    }
  }
  return { result: "inserted", id: insertData?.id };
}

// --- Logging ---

async function logRun(
  supabase: SupabaseClient,
  sourceName: string,
  status: "success" | "error",
  eventsFound: number,
  eventsInserted: number,
  eventsMerged: number,
  errorMessage: string | null,
  startedAt: number
) {
  await supabase.from("scrape_logs").insert({
    source_id:       null,
    source_name:     sourceName,
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Main scraper ---

async function scrapeSagriamo(supabase: SupabaseClient): Promise<void> {
  const sourceName = "sagriamo";
  const startedAt = Date.now();
  let eventsFound = 0;
  let eventsInserted = 0;
  let eventsMerged = 0;

  try {
    const PER_PAGE = 100;
    const MAX_PAGES = 10;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `https://app.sagriamo.it/api/festival/all?page=${page}&perPage=${PER_PAGE}`;
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Nemovia/1.0; +https://nemovia.it)",
          "Accept": "application/json",
        },
      });

      if (!resp.ok) {
        console.error(`[scrapeSagriamo] HTTP ${resp.status} on page ${page}`);
        break;
      }

      const data = await resp.json();
      const items: Array<Record<string, unknown>> = data.items || [];
      const totalPages: number = data.npages || 1;

      if (items.length === 0) break;

      for (const item of items) {
        const address = item.address as Record<string, string> | null;
        const province = normalizeProvinceCode(address?.province || "");
        if (!VENETO_PROVINCE_CODES.includes(province)) continue;

        const title = String(item.name || "").trim();
        if (!title) continue;
        if (isNoiseTitle(title)) continue;
        if (isNonSagraTitle(title)) continue;

        const city = (address?.city || "").trim();
        const startDate = item.active_from ? String(item.active_from) : null;
        const endDate = item.active_to ? String(item.active_to) : null;

        let imageUrl: string | null = null;
        const covers = Array.isArray(item.cover) ? item.cover as string[] : [];
        const logos = Array.isArray(item.logo) ? item.logo as string[] : [];
        if (covers.length > 0 && covers[0]) {
          imageUrl = covers[0];
        } else if (logos.length > 0 && logos[0]) {
          imageUrl = logos[0];
        }

        const slug = item.slug ? String(item.slug) : null;
        const sourceUrl = slug ? `https://www.sagriamo.it/sagra/${slug}` : null;

        const normalized: NormalizedEvent = {
          title: title.slice(0, 200),
          normalizedTitle: normalizeText(title),
          slug: generateSlug(title, city),
          city,
          startDate,
          endDate,
          priceInfo: null,
          isFree: null,
          imageUrl: tryUpgradeImageUrl(imageUrl, sourceName),
          url: sourceUrl,
          contentHash: generateContentHash(title, city, startDate),
          province,
        };

        // Date quality gates (sagriamo events are curated, allow up to 25 days)
        if (isCalendarDateRange(normalized.startDate, normalized.endDate)) continue;
        if (isExcessiveDuration(normalized.startDate, normalized.endDate, 25)) continue;
        if (isPastYearEvent(normalized.startDate, normalized.endDate)) continue;

        const { result, id: eventId } = await upsertEvent(supabase, normalized, sourceName);
        eventsFound++;
        if (result === "inserted") eventsInserted++;
        else if (result === "merged") eventsMerged++;

        // Sagriamo API returns rich descriptions -- store directly for new inserts
        if (result === "inserted" && eventId) {
          const desc = typeof item.description === "string" ? item.description.trim() : null;
          if (desc && desc.length > 10) {
            const cleanDesc = desc.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
            await supabase.from("sagre").update({
              source_description: cleanDesc.slice(0, 1000),
              updated_at: new Date().toISOString(),
            }).eq("id", eventId);
          }
        }
      }

      if (page >= totalPages) break;

      // Politeness delay between pages
      await new Promise((r) => setTimeout(r, 1500));
    }

    await logRun(supabase, sourceName, "success", eventsFound, eventsInserted, eventsMerged, null, startedAt);
    console.log(`[scrapeSagriamo] done: found=${eventsFound}, inserted=${eventsInserted}, merged=${eventsMerged}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[scrapeSagriamo] Error:`, errorMessage);
    await logRun(supabase, sourceName, "error", eventsFound, eventsInserted, eventsMerged, errorMessage, startedAt);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log("[scrape-sagriamo] Starting...");

  EdgeRuntime.waitUntil(scrapeSagriamo(supabase));

  return new Response(
    JSON.stringify({ status: "started", timestamp: new Date().toISOString() }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
