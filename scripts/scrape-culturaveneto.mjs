// =============================================================================
// scrape-culturaveneto.mjs — Scrape sagre/food events from culturaveneto.it
// Source: https://www.culturaveneto.it/it/attivita/fiere-mercatini-enogastronomia
// Static HTML, Cheerio parsing, cursor-based pagination via "Avanti" link.
// Run: node scripts/scrape-culturaveneto.mjs
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as cheerio from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- Config ---

const BASE_URL = "https://www.culturaveneto.it";
const LISTING_PATH = "/it/attivita/fiere-mercatini-enogastronomia";
const SOURCE_NAME = "culturaveneto";
const MAX_PAGES = 20; // safety cap (expect ~14)
const MAX_DETAIL_FETCHES = 200; // fetch ALL detail pages — dates are ONLY on detail pages for single-day events
const DELAY_MS = 1500; // politeness delay between requests

// --- Helper functions ---

const ACCENT_MAP = {
  à: "a", á: "a", â: "a", ã: "a", ä: "a", å: "a",
  è: "e", é: "e", ê: "e", ë: "e",
  ì: "i", í: "i", î: "i", ï: "i",
  ò: "o", ó: "o", ô: "o", õ: "o", ö: "o",
  ù: "u", ú: "u", û: "u", ü: "u",
  ñ: "n", ç: "c",
};

function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[àáâãäåèéêëìíîïòóôõöùúûüñç]/g, (c) => ACCENT_MAP[c] ?? c)
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function generateSlug(title, city) {
  return normalizeText(`${title} ${city}`).replace(/\s+/g, "-").slice(0, 100);
}

function generateContentHash(title, city, startDate) {
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

/**
 * Parse DD/MM/YYYY to YYYY-MM-DD
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Extract province code (2 uppercase letters in parentheses) from text
 */
function extractProvinceCode(text) {
  if (!text) return null;
  const match = text.match(/\(([A-Z]{2})\)/);
  if (match) {
    const code = match[1];
    const venetoProvinces = ["BL", "PD", "RO", "TV", "VE", "VI", "VR"];
    if (venetoProvinces.includes(code)) return code;
  }
  return null;
}

/**
 * Extract city name from location text, cleaning up the province part
 */
function extractCity(locationText) {
  if (!locationText) return "";
  // Location format: "Venue Name | Address, City (BL)" or just "City (BL)"
  // Extract city from the last part after comma, before province code
  let text = locationText;
  // If there's a pipe, take the part after it (the address)
  if (text.includes("|")) {
    text = text.split("|").pop().trim();
  }
  // Extract the city: last segment before (XX) province code, after the last comma
  const provMatch = text.match(/,\s*([^,]+?)\s*\([A-Z]{2}\)\s*$/);
  if (provMatch) return provMatch[1].trim();
  // Fallback: strip province code and any address prefix
  return text.replace(/\s*\([A-Z]{2}\)\s*/, "").replace(/.*,\s*/, "").trim();
}

/**
 * Fetch a URL with retry and delay
 */
async function fetchPage(url) {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "NemoviaBot/1.0 (sagre aggregator; +https://nemovia.it)",
      "Accept": "text/html",
      "Accept-Language": "it-IT,it;q=0.9",
    },
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} for ${url}`);
  }
  return await resp.text();
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Scrape listing pages ---

async function scrapeListingPage(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const events = [];

  $("div.col-xs-12.col-sm-4.col-md-3 > div.thumbnail").each((_, el) => {
    const $el = $(el);

    // Title and detail URL
    const $titleLink = $el.find("div.caption h3 a");
    const title = $titleLink.text().trim();
    let detailPath = $titleLink.attr("href") || "";
    if (detailPath && !detailPath.startsWith("http")) {
      detailPath = BASE_URL + detailPath;
    }

    // Image
    let imageUrl = $el.find("div.img-holder img").attr("src") || "";
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = BASE_URL + imageUrl;
    }

    // Dates — "Dal DD/MM/YYYY" + "Al DD/MM/YYYY" for multi-day, "Il DD/MM/YYYY" for single-day
    const captionText = $el.find("div.caption").text();
    const startMatch = captionText.match(/Dal\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    const endMatch = captionText.match(/Al\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    const singleMatch = captionText.match(/Il:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    const startDate = startMatch ? parseDate(startMatch[1]) : (singleMatch ? parseDate(singleMatch[1]) : null);
    const endDate = endMatch ? parseDate(endMatch[1]) : null;

    // Location — from info-detail paragraph
    const locationText = $el.find("div.info-detail p").text().trim();
    const province = extractProvinceCode(locationText);
    const city = extractCity(locationText);

    if (title) {
      events.push({
        title: title.slice(0, 200),
        detailUrl: detailPath,
        imageUrl: imageUrl || null,
        startDate,
        endDate: endDate || startDate,
        locationText,
        city,
        province,
      });
    }
  });

  // Find "Avanti" (next page) link
  let nextUrl = null;
  $("a").each((_, el) => {
    const text = $(el).text().trim();
    if (text === "Avanti" || text === "Avanti »" || text.includes("Avanti")) {
      let href = $(el).attr("href");
      if (href) {
        if (!href.startsWith("http")) href = BASE_URL + href;
        nextUrl = href;
      }
    }
  });

  return { events, nextUrl };
}

// --- Scrape detail page for description + GPS coords ---

async function scrapeDetailPage(url) {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    // Description from #paragraph
    let description = "";
    const $para = $("#paragraph");
    if ($para.length) {
      description = $para.text().trim().slice(0, 1000);
    }

    // GPS coords from data-map-markers attribute
    let lat = null;
    let lng = null;
    const mapMarkers = $("[data-map-markers]").attr("data-map-markers");
    if (mapMarkers) {
      try {
        const markers = JSON.parse(mapMarkers);
        if (Array.isArray(markers) && markers.length > 0) {
          lat = parseFloat(markers[0].lat || markers[0].latitude);
          lng = parseFloat(markers[0].lng || markers[0].longitude || markers[0].lon);
          if (isNaN(lat) || isNaN(lng)) { lat = null; lng = null; }
        }
      } catch {
        // Try regex fallback for non-standard JSON
        const latMatch = mapMarkers.match(/"lat(?:itude)?":\s*([\d.]+)/);
        const lngMatch = mapMarkers.match(/"(?:lng|longitude|lon)":\s*([\d.]+)/);
        if (latMatch && lngMatch) {
          lat = parseFloat(latMatch[1]);
          lng = parseFloat(lngMatch[1]);
        }
      }
    }

    // Extract dates from detail page (single-day events use "Il: DD/MM/YYYY",
    // multi-day use "Dal DD/MM/YYYY" / "Al DD/MM/YYYY")
    const detailText = $(".info-detail").text();
    let startDate = null;
    let endDate = null;
    const dalMatch = detailText.match(/Dal\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    const alMatch = detailText.match(/Al\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    const ilMatch = detailText.match(/Il:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (dalMatch) startDate = parseDate(dalMatch[1]);
    if (alMatch) endDate = parseDate(alMatch[1]);
    if (!startDate && ilMatch) startDate = parseDate(ilMatch[1]);
    if (startDate && !endDate) endDate = startDate;

    return { description, lat, lng, startDate, endDate };
  } catch (err) {
    console.warn(`[culturaveneto] Detail fetch failed: ${url} — ${err.message}`);
    return { description: "", lat: null, lng: null, startDate: null, endDate: null };
  }
}

// --- Main ---

async function scrapeCulturaVeneto() {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let detailFetches = 0;

  // Phase 1: Scrape all listing pages
  console.log(`[culturaveneto] Starting scrape of ${BASE_URL}${LISTING_PATH}`);
  const allEvents = [];
  let currentUrl = BASE_URL + LISTING_PATH;
  let pageNum = 0;

  while (currentUrl && pageNum < MAX_PAGES) {
    pageNum++;
    console.log(`[culturaveneto] Page ${pageNum}/${MAX_PAGES}: ${currentUrl}`);

    try {
      const { events, nextUrl } = await scrapeListingPage(currentUrl);
      console.log(`[culturaveneto] Page ${pageNum}: ${events.length} events found`);
      allEvents.push(...events);
      currentUrl = nextUrl;
    } catch (err) {
      console.error(`[culturaveneto] Page ${pageNum} failed: ${err.message}`);
      totalErrors++;
      break;
    }

    await delay(DELAY_MS);
  }

  totalFound = allEvents.length;
  console.log(`\n[culturaveneto] Total events from listings: ${totalFound}`);

  // Phase 2: Dedup check and insert
  for (const event of allEvents) {
    const normalizedTitle = normalizeText(event.title);
    const slug = generateSlug(event.title, event.city || "veneto");
    const contentHash = generateContentHash(event.title, event.city || "veneto", event.startDate);

    // Dedup check via RPC
    const { data: dupes } = await supabase.rpc("find_duplicate_sagra", {
      p_normalized_title: normalizedTitle,
      p_city: (event.city || "").toLowerCase(),
      p_start_date: event.startDate,
      p_end_date: event.endDate,
    });

    const existing = dupes?.[0];
    if (existing) {
      if (existing.sources?.includes(SOURCE_NAME)) {
        totalSkipped++;
        continue;
      }
      // Merge: add culturaveneto as source
      const updateData = {
        sources: [...(existing.sources ?? []), SOURCE_NAME],
        updated_at: new Date().toISOString(),
      };
      // Fill in missing data from this source
      if (!existing.image_url && event.imageUrl) updateData.image_url = event.imageUrl;
      if (!existing.province && event.province) updateData.province = event.province;
      if (!existing.source_url && event.detailUrl) updateData.source_url = event.detailUrl;

      await supabase.from("sagre").update(updateData).eq("id", existing.id);
      totalMerged++;
      console.log(`[culturaveneto] Merged: ${event.title}`);
      continue;
    }

    // Fetch detail page for description + GPS (if within limit)
    let description = "";
    let lat = null;
    let lng = null;

    if (detailFetches < MAX_DETAIL_FETCHES && event.detailUrl) {
      await delay(DELAY_MS);
      const detail = await scrapeDetailPage(event.detailUrl);
      description = detail.description;
      lat = detail.lat;
      lng = detail.lng;
      // Use detail page dates when listing page didn't have them
      if (!event.startDate && detail.startDate) {
        event.startDate = detail.startDate;
        event.endDate = detail.endDate || detail.startDate;
      }
      detailFetches++;
    }

    // Build insert data
    const hasCoords = lat != null && lng != null;
    const insertData = {
      title: event.title,
      slug,
      location_text: event.locationText || event.city || "Veneto",
      start_date: event.startDate,
      end_date: event.endDate || event.startDate,
      image_url: event.imageUrl,
      source_url: event.detailUrl || `${BASE_URL}${LISTING_PATH}`,
      source_description: description || null,
      sources: [SOURCE_NAME],
      is_active: false,
      review_status: "pending",
      status: hasCoords ? "pending_llm" : "pending_geocode",
      content_hash: contentHash,
      province: event.province,
    };

    if (hasCoords) {
      insertData.location = `SRID=4326;POINT(${lng} ${lat})`;
    }

    const { error } = await supabase.from("sagre").insert(insertData);
    if (error) {
      if (error.code === "23505") {
        // Slug/hash collision — retry with unique suffix
        const suffix = Date.now().toString(36);
        insertData.slug = slug + "-" + suffix;
        insertData.content_hash = contentHash + suffix;
        const { error: retryError } = await supabase.from("sagre").insert(insertData);
        if (retryError) {
          console.error(`[culturaveneto] Insert retry error for "${event.title}": ${retryError.message}`);
          totalErrors++;
          continue;
        }
      } else {
        console.error(`[culturaveneto] Insert error for "${event.title}": ${error.message}`);
        totalErrors++;
        continue;
      }
    }

    totalInserted++;
    console.log(`[culturaveneto] Inserted: ${event.title} (${event.city || "?"}) [${event.startDate || "no date"}]`);
  }

  // Log run to scrape_logs
  await supabase.from("scrape_logs").insert({
    source_id: null,
    source_name: SOURCE_NAME,
    status: totalErrors > 0 && totalInserted === 0 ? "error" : "success",
    events_found: totalFound,
    events_inserted: totalInserted,
    events_merged: totalMerged,
    error_message: totalErrors > 0
      ? `${totalErrors} errors, ${totalSkipped} skipped, ${detailFetches} detail pages fetched`
      : `${totalSkipped} skipped, ${detailFetches} detail pages fetched`,
    duration_ms: Date.now() - startedAt,
    completed_at: new Date().toISOString(),
  });

  console.log(`\n[culturaveneto] Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  console.log(`[culturaveneto] Found=${totalFound}, Inserted=${totalInserted}, Merged=${totalMerged}, Skipped=${totalSkipped}, Errors=${totalErrors}`);
  console.log(`[culturaveneto] Detail pages fetched: ${detailFetches}/${MAX_DETAIL_FETCHES}`);
}

scrapeCulturaVeneto().catch((err) => {
  console.error("[culturaveneto] Fatal error:", err);
  process.exit(1);
});
