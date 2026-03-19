// =============================================================================
// scrape-facebook.mjs — Scrape sagre events from Facebook Pro Loco pages
// Uses facebook-event-scraper (npm) for unauthenticated public page scraping.
// Run: node scripts/scrape-facebook.mjs
// =============================================================================

import { scrapeFbEventList, scrapeFbEvent } from "facebook-event-scraper";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- Facebook pages: read from DB (external_sources), fallback to hardcoded ---
const FALLBACK_FB_PAGES = [
  "https://www.facebook.com/sagre.veneto/events",
  "https://www.facebook.com/SagrenelVeneto/events",
  "https://www.facebook.com/unpliveneto.proloco/events",
  "https://www.facebook.com/prolocoverona/events",
];

async function loadFacebookPages() {
  try {
    const { data } = await supabase
      .from("external_sources")
      .select("url")
      .eq("type", "facebook")
      .eq("is_active", true);
    if (data && data.length > 0) {
      console.log(`[fb] Loaded ${data.length} pages from DB`);
      return data.map((r) => r.url);
    }
  } catch (e) {
    console.warn("[fb] Could not load from external_sources, using fallback:", e.message);
  }
  console.log(`[fb] Using ${FALLBACK_FB_PAGES.length} hardcoded pages`);
  return FALLBACK_FB_PAGES;
}

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
  return normalizeText(`${title} ${city}`).replace(/\s+/g, "-");
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

function isFoodEvent(title) {
  const t = title.toLowerCase();
  return /\b(sagra|sagre|festa\s+d[ei]l|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia|salsiccia|castagne|zucca|bisi|carciofi|olio|riso|oca|bigoli|cinghiale|trippa|lumache|rane|bufala|focaccia|pinza|prosciutt|salame|pasta|pizza|gelato|dolci|tiramisù|fragol|cilieg|mele|uva|miele|pane|gastronomia|cucina|sapori|gusto|prodotti\s+tipici|street\s*food|food|cibo)\b/i.test(t);
}

// Veneto province detection from location text
const VENETO_CITIES_PROVINCES = {
  BL: ["belluno", "feltre", "cortina", "agordo", "sedico"],
  PD: ["padova", "abano", "cittadella", "este", "monselice", "piove", "camposampiero", "selvazzano", "rubano", "albignasego", "cadoneghe"],
  RO: ["rovigo", "adria", "badia polesine", "lendinara", "porto viro"],
  TV: ["treviso", "castelfranco", "conegliano", "montebelluna", "oderzo", "vittorio veneto", "mogliano"],
  VE: ["venezia", "mestre", "chioggia", "jesolo", "san donà", "mirano", "spinea", "noale", "portogruaro"],
  VI: ["vicenza", "bassano", "schio", "thiene", "valdagno", "arzignano", "lonigo", "marostica", "asiago"],
  VR: ["verona", "villafranca", "legnago", "san bonifacio", "bussolengo", "negrar", "peschiera", "bardolino", "soave"],
};

function detectProvince(locationText) {
  if (!locationText) return null;
  const t = locationText.toLowerCase();
  for (const [code, cities] of Object.entries(VENETO_CITIES_PROVINCES)) {
    for (const city of cities) {
      if (t.includes(city)) return code;
    }
  }
  // Check for province code in text
  const codeMatch = t.match(/\b(bl|pd|ro|tv|ve|vi|vr)\b/i);
  if (codeMatch) return codeMatch[1].toUpperCase();
  return null;
}

// --- Main scraper ---

async function scrapeEvents() {
  const startedAt = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  const FB_PAGES = await loadFacebookPages();
  for (const pageUrl of FB_PAGES) {
    const pageName = pageUrl.match(/facebook\.com\/([^/]+)/)?.[1] || pageUrl;
    console.log(`\n[fb] Scraping: ${pageName}`);

    let eventList;
    try {
      eventList = await scrapeFbEventList(pageUrl);
    } catch (err) {
      console.error(`[fb] Failed to get event list from ${pageName}:`, err.message);
      totalErrors++;
      continue;
    }

    if (!eventList || eventList.length === 0) {
      console.log(`[fb] No events found on ${pageName}`);
      continue;
    }

    console.log(`[fb] ${pageName}: ${eventList.length} events in list`);

    // Filter upcoming events only
    const upcoming = eventList.filter(e => !e.isPast && !e.isCanceled);
    console.log(`[fb] ${pageName}: ${upcoming.length} upcoming events`);

    for (const shortEvent of upcoming) {
      totalFound++;

      // Fetch full event details
      let fullEvent;
      try {
        const eventUrl = shortEvent.url || `https://www.facebook.com/events/${shortEvent.id}`;
        fullEvent = await scrapeFbEvent(eventUrl);
        // Politeness delay
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.warn(`[fb] Failed to scrape event ${shortEvent.id}:`, err.message);
        totalErrors++;
        continue;
      }

      if (!fullEvent || !fullEvent.name) continue;

      // Filter: only food-related events
      if (!isFoodEvent(fullEvent.name)) {
        console.log(`[fb] Skip (not food): ${fullEvent.name}`);
        totalSkipped++;
        continue;
      }

      // Extract location
      const city = fullEvent.location?.city?.name
        || fullEvent.location?.name
        || "";

      // Check if Veneto
      const locationStr = `${city} ${fullEvent.location?.address || ""} ${fullEvent.location?.city?.name || ""}`;
      const province = detectProvince(locationStr);
      // Skip if we can't determine it's in Veneto (be generous — keep if unknown)

      // Extract dates
      let startDate = null;
      let endDate = null;
      if (fullEvent.startTimestamp) {
        startDate = new Date(fullEvent.startTimestamp * 1000).toISOString().slice(0, 10);
      }
      if (fullEvent.endTimestamp) {
        endDate = new Date(fullEvent.endTimestamp * 1000).toISOString().slice(0, 10);
      }

      // Extract image
      let imageUrl = fullEvent.photo?.imageUri || fullEvent.photo?.url || null;

      // Extract coordinates
      let lat = fullEvent.location?.coordinates?.latitude || null;
      let lng = fullEvent.location?.coordinates?.longitude || null;

      const title = fullEvent.name.slice(0, 200);
      const normalizedTitle = normalizeText(title);
      const slug = generateSlug(title, city || "veneto");
      const contentHash = generateContentHash(title, city || "veneto", startDate);

      // Dedup check
      const { data: dupes } = await supabase.rpc("find_duplicate_sagra", {
        p_normalized_title: normalizedTitle,
        p_city: (city || "").toLowerCase(),
        p_start_date: startDate,
        p_end_date: endDate,
      });

      const existing = dupes?.[0];
      if (existing) {
        if (existing.sources?.includes("facebook")) {
          totalSkipped++;
          continue;
        }
        // Merge: add facebook as source
        await supabase.from("sagre").update({
          image_url: existing.image_url ?? imageUrl,
          sources: [...(existing.sources ?? []), "facebook"],
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
        totalMerged++;
        console.log(`[fb] Merged: ${title}`);
        continue;
      }

      // Insert new sagra
      const hasCoords = lat != null && lng != null;
      const insertData = {
        title,
        slug,
        location_text: city || "Veneto",
        start_date: startDate,
        end_date: endDate || startDate,
        image_url: imageUrl,
        source_url: fullEvent.url || `https://www.facebook.com/events/${fullEvent.id}`,
        source_description: fullEvent.description?.slice(0, 1000) || null,
        sources: ["facebook"],
        is_active: false,
        status: hasCoords ? "pending_llm" : "pending_geocode",
        content_hash: contentHash,
      };

      if (hasCoords) {
        insertData.location = `SRID=4326;POINT(${lng} ${lat})`;
        insertData.province = province;
      }

      const { error } = await supabase.from("sagre").insert(insertData);
      if (error) {
        if (error.code === "23505") {
          // Slug collision
          insertData.slug = slug + "-" + Date.now().toString(36);
          insertData.content_hash = contentHash + Date.now().toString(36);
          await supabase.from("sagre").insert(insertData);
        } else {
          console.error(`[fb] Insert error:`, error.message);
          totalErrors++;
          continue;
        }
      }
      totalInserted++;
      console.log(`[fb] Inserted: ${title} (${city})`);
    }
  }

  // Log run
  const completedAt = new Date().toISOString();
  await supabase.from("scrape_logs").insert({
    source_id: null,
    source_name: "facebook",
    status: totalErrors > 0 && totalInserted === 0 ? "error" : "success",
    events_found: totalFound,
    events_inserted: totalInserted,
    events_merged: totalMerged,
    error_message: totalErrors > 0 ? `${totalErrors} errors, ${totalSkipped} non-food skipped` : null,
    duration_ms: Date.now() - startedAt,
    completed_at: completedAt,
  });

  // Update last_scraped_at on all active facebook sources
  await supabase.from("external_sources")
    .update({ last_scraped_at: completedAt, last_result: { found: totalFound, inserted: totalInserted, merged: totalMerged, errors: totalErrors } })
    .eq("type", "facebook").eq("is_active", true);

  console.log(`\n[fb] Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  console.log(`[fb] Found=${totalFound}, Inserted=${totalInserted}, Merged=${totalMerged}, Skipped=${totalSkipped}, Errors=${totalErrors}`);
}

scrapeEvents().catch(console.error);
