import * as cheerio from "npm:cheerio@1";
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
}

interface DuplicateResult {
  id: string;
  image_url: string | null;
  price_info: string | null;
  is_free: boolean | null;
  sources: string[];
}

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

interface DetailContent {
  description: string | null;
  menu: string | null;
  orari: string | null;
  startDate: string | null;
  endDate: string | null;
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
    is_active:     true,
    status:        "pending_geocode",
    content_hash:  event.contentHash,
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
        is_active:     true,
        status:        "pending_geocode",
        content_hash:  event.contentHash + Date.now().toString(36),
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
  status: "success" | "error" | "skipped",
  eventsFound: number,
  eventsInserted: number,
  eventsMerged: number,
  errorMessage: string | null,
  startedAt: number,
  extra?: string
) {
  await supabase.from("scrape_logs").insert({
    source_id:       null, // custom scraper, no DB source row
    source_name:     sourceName,
    status,
    events_found:    eventsFound,
    events_inserted: eventsInserted,
    events_merged:   eventsMerged,
    error_message:   errorMessage ? (extra ? `${errorMessage} [${extra}]` : errorMessage) : extra || null,
    duration_ms:     Date.now() - startedAt,
    completed_at:    new Date().toISOString(),
  });
}

// --- Detail page extraction ---

function extractSagretodayDetail($: cheerio.CheerioAPI): DetailContent {
  let description: string | null = null;
  let orari: string | null = null;
  let startDate: string | null = null;
  let endDate: string | null = null;

  $('script[type="application/ld+json"]').each((_i: number, el: cheerio.Element) => {
    try {
      const jsonData = JSON.parse($(el).text().trim());
      if (jsonData["@type"] === "Event") {
        if (jsonData.description) {
          description = String(jsonData.description).slice(0, 1000);
        }
        // Extract dates from detail page JSON-LD
        if (jsonData.startDate) {
          startDate = String(jsonData.startDate).slice(0, 10);
        }
        if (jsonData.endDate) {
          endDate = String(jsonData.endDate).slice(0, 10);
        }
      }
    } catch { /* skip */ }
  });

  if (!description) {
    const bodyText = $("main, article, .content, [class*='description']").first().text().trim();
    if (bodyText && bodyText.length > 50) {
      description = bodyText.slice(0, 1000);
    }
  }

  const pageText = $("body").text();
  const orariMatch = pageText.match(/(?:ore|dalle|orario|apertura)\s*:?\s*\d{1,2}[.:]\d{2}/i);
  if (orariMatch) {
    const idx = pageText.indexOf(orariMatch[0]);
    const start = Math.max(0, idx - 50);
    const end = Math.min(pageText.length, idx + orariMatch[0].length + 150);
    orari = pageText.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 500);
  }

  return { description, menu: null, orari, startDate, endDate };
}

async function scrapeDetailPages(
  supabase: SupabaseClient,
  eventUrls: Array<{ id: string; url: string }>
): Promise<{ scraped: number; updated: number; datesRecovered: number }> {
  let scraped = 0;
  let updated = 0;
  let datesRecovered = 0;
  const MAX_DETAIL_PAGES = 15; // more detail pages to recover dates faster

  for (const { id, url } of eventUrls.slice(0, MAX_DETAIL_PAGES)) {
    const html = await fetchWithTimeout(url, 10_000);
    if (!html) continue;
    scraped++;

    const $ = cheerio.load(html);
    const detail = extractSagretodayDetail($);

    // Fetch current state to apply NULL-only updates
    const { data: existing } = await supabase
      .from("sagre")
      .select("source_description, menu_text, orari_text, start_date, end_date")
      .eq("id", id)
      .single();

    const finalUpdates: Record<string, string> = {};
    if (detail.description && !existing?.source_description) {
      finalUpdates.source_description = detail.description;
    }
    if (detail.menu && !existing?.menu_text) {
      finalUpdates.menu_text = detail.menu;
    }
    if (detail.orari && !existing?.orari_text) {
      finalUpdates.orari_text = detail.orari;
    }
    // Recover dates if missing
    if (detail.startDate && !existing?.start_date) {
      finalUpdates.start_date = detail.startDate;
      datesRecovered++;
    }
    if (detail.endDate && !existing?.end_date) {
      finalUpdates.end_date = detail.endDate;
    }

    if (Object.keys(finalUpdates).length > 0) {
      await supabase.from("sagre").update({
        ...finalUpdates,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      updated++;
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  return { scraped, updated, datesRecovered };
}

async function getEventsNeedingDetails(
  supabase: SupabaseClient,
  limit: number = 15
): Promise<Array<{ id: string; url: string }>> {
  // Priority 1: sagre with NULL dates (most critical — invisible on homepage)
  const { data: needDates } = await supabase
    .from("sagre")
    .select("id, source_url")
    .eq("is_active", true)
    .not("source_url", "is", null)
    .is("start_date", null)
    .contains("sources", ["sagretoday"])
    .limit(limit);

  const results: Array<{ id: string; url: string }> = (needDates ?? [])
    .filter((r: { source_url: string | null }) => r.source_url != null)
    .map((r: { id: string; source_url: string }) => ({ id: r.id, url: r.source_url }));

  // Priority 2: sagre needing description (fill remaining slots)
  if (results.length < limit) {
    const seenIds = new Set(results.map(r => r.id));
    const { data: needDesc } = await supabase
      .from("sagre")
      .select("id, source_url")
      .eq("is_active", true)
      .not("source_url", "is", null)
      .is("source_description", null)
      .contains("sources", ["sagretoday"])
      .limit(limit - results.length);

    for (const r of needDesc ?? []) {
      if (r.source_url && !seenIds.has(r.id)) {
        results.push({ id: r.id, url: r.source_url });
      }
    }
  }

  return results;
}

// --- CHUNKED PROVINCE SCRAPING ---
// Processes ONLY 1 province per invocation (all 5 pages for that province).
// Uses time-based round-robin: every 30 minutes picks a different province.

const PROVINCES = ["belluno", "padova", "rovigo", "treviso", "venezia", "vicenza", "verona"];

function getCurrentProvince(): string {
  const provinceIndex = Math.floor(Date.now() / (30 * 60 * 1000)) % PROVINCES.length;
  return PROVINCES[provinceIndex];
}

async function scrapeSagretodayProvince(supabase: SupabaseClient, province: string): Promise<void> {
  const sourceName = "sagretoday";
  const startedAt = Date.now();
  let eventsFound = 0;
  let eventsInserted = 0;
  let eventsMerged = 0;

  try {
    const MAX_PAGES = 5;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1
        ? `https://www.sagretoday.it/sagre/veneto/${province}/`
        : `https://www.sagretoday.it/sagre/veneto/${province}/page/${page}/`;

      console.log(`[scrapeSagretoday] Fetching ${province} page ${page}: ${url}`);
      const html = await fetchWithTimeout(url, 15_000);
      if (!html) {
        console.log(`[scrapeSagretoday] No HTML for ${province} page ${page}, stopping pagination`);
        break;
      }

      const $ = cheerio.load(html);

      // Extract events from JSON-LD structured data
      const jsonLdScripts = $('script[type="application/ld+json"]');
      let itemListFound = false;
      const jsonLdEvents: NormalizedEvent[] = [];

      jsonLdScripts.each((_i: number, el: cheerio.Element) => {
        try {
          const jsonText = $(el).text().trim();
          if (!jsonText) return;
          const jsonData = JSON.parse(jsonText);

          if (jsonData["@type"] !== "ItemList") return;
          const elements = jsonData.itemListElement || [];
          if (elements.length === 0) return;
          itemListFound = true;

          for (const eventItem of elements) {
            const event = eventItem["@type"] === "Event"
              ? eventItem
              : eventItem.item && eventItem.item["@type"] === "Event"
                ? eventItem.item
                : null;

            if (!event) continue;

            const title = String(event.name || "").trim();
            if (!title) continue;
            if (isNoiseTitle(title)) continue;
            if (isNonSagraTitle(title)) continue;

            let city = "";
            if (event.location) {
              if (typeof event.location === "string") {
                city = event.location;
              } else {
                city = event.location.name
                  || event.location.address?.addressLocality
                  || "";
              }
            }
            city = city.trim();

            let startDate: string | null = null;
            let endDate: string | null = null;
            if (event.startDate) startDate = String(event.startDate).slice(0, 10);
            if (event.endDate) endDate = String(event.endDate).slice(0, 10);

            let imageUrl: string | null = null;
            if (event.image) {
              if (typeof event.image === "string") {
                imageUrl = event.image;
              } else if (Array.isArray(event.image) && event.image.length > 0) {
                imageUrl = event.image[0];
              } else if (event.image.url) {
                imageUrl = event.image.url;
              }
            }

            let sourceUrl: string | null = event.url || null;
            if (sourceUrl && !sourceUrl.startsWith("http")) {
              sourceUrl = `https://www.sagretoday.it${sourceUrl}`;
            }

            const isFree = event.isAccessibleForFree === true ? true : null;

            const normalized: NormalizedEvent = {
              title: title.slice(0, 200),
              normalizedTitle: normalizeText(title),
              slug: generateSlug(title, city || province),
              city: city || province,
              startDate,
              endDate: endDate || startDate,
              priceInfo: null,
              isFree,
              imageUrl: tryUpgradeImageUrl(imageUrl, sourceName),
              url: sourceUrl,
              contentHash: generateContentHash(title, city || province, startDate),
            };

            if (isCalendarDateRange(normalized.startDate, normalized.endDate)) continue;
            if (isExcessiveDuration(normalized.startDate, normalized.endDate, 7)) continue;
            if (isPastYearEvent(normalized.startDate, normalized.endDate)) continue;

            jsonLdEvents.push(normalized);
          }
        } catch {
          // JSON parse error -- skip
        }
      });

      // Process collected JSON-LD events
      for (const normalized of jsonLdEvents) {
        const { result } = await upsertEvent(supabase, normalized, sourceName);
        eventsFound++;
        if (result === "inserted") eventsInserted++;
        else if (result === "merged") eventsMerged++;
      }

      // Fallback: if no JSON-LD found, try scraping links from the HTML
      if (!itemListFound) {
        const links = $('a[href*="/sagra/"]');
        const seenHrefs = new Set<string>();
        const fallbackEvents: NormalizedEvent[] = [];

        links.each((_i: number, el: cheerio.Element) => {
          const href = $(el).attr("href") || "";
          if (!href.match(/\/sagra\/[^/]+--e_[^/]+/)) return;
          if (seenHrefs.has(href)) return;
          seenHrefs.add(href);

          let title = $(el).find("h2, h3, h4, .geo-card-title, p").first().text().trim();
          if (!title) title = $(el).text().trim();
          if (!title || title.length < 5) return;
          if (isNoiseTitle(title)) return;
          if (isNonSagraTitle(title)) return;

          const sourceUrl = href.startsWith("http")
            ? href
            : `https://www.sagretoday.it${href}`;

          fallbackEvents.push({
            title: title.slice(0, 200),
            normalizedTitle: normalizeText(title),
            slug: generateSlug(title, province),
            city: province,
            startDate: null,
            endDate: null,
            priceInfo: null,
            isFree: null,
            imageUrl: null,
            url: sourceUrl,
            contentHash: generateContentHash(title, province, null),
          });
        });

        for (const normalized of fallbackEvents) {
          const { result } = await upsertEvent(supabase, normalized, sourceName);
          eventsFound++;
          if (result === "inserted") eventsInserted++;
          else if (result === "merged") eventsMerged++;
        }
      }

      // Check if there's a next page link
      const hasNextPage = $('a[href*="/page/"]').filter((_i: number, el: cheerio.Element) => {
        const text = $(el).text().toLowerCase();
        return text.includes("successiva") || text.includes("next") || text.includes("\u2192");
      }).length > 0;

      if (!hasNextPage) break;

      // Politeness delay between pages
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Detail page scraping for sagretoday (limited to stay in time budget)
    const detailUrls = await getEventsNeedingDetails(supabase, 15);
    if (detailUrls.length > 0) {
      const { scraped, updated, datesRecovered } = await scrapeDetailPages(supabase, detailUrls);
      console.log(`[scrapeSagretoday] ${province}: detail pages scraped=${scraped}, updated=${updated}, datesRecovered=${datesRecovered}`);
    }

    await logRun(supabase, "sagretoday", "success", eventsFound, eventsInserted, eventsMerged, null, startedAt, `province=${province}`);
    console.log(`[scrapeSagretoday] ${province} done: found=${eventsFound}, inserted=${eventsInserted}, merged=${eventsMerged}, duration=${Date.now() - startedAt}ms`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[scrapeSagretoday] Error scraping ${province}:`, errorMessage);
    await logRun(supabase, "sagretoday", "error", eventsFound, eventsInserted, eventsMerged, errorMessage, startedAt, `province=${province}`);
  }
}

// --- Entry point ---

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const province = getCurrentProvince();
  console.log(`[scrape-sagretoday] Starting. Province rotation: ${province} (index ${PROVINCES.indexOf(province)}/${PROVINCES.length})`);

  // Fire-and-forget: return 200 immediately, work continues in background
  EdgeRuntime.waitUntil(scrapeSagretodayProvince(supabase, province));

  return new Response(
    JSON.stringify({
      status: "started",
      province,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
