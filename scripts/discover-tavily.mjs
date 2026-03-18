// =============================================================================
// discover-tavily.mjs — Discover new sagre via Tavily Search API
// Uses free tier (1000 credits/month, 1 credit = 1 basic search).
// Searches for sagre by province and upcoming months, deduplicates against DB.
// Run: node scripts/discover-tavily.mjs
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const TAVILY_API_KEY = process.env.TAVILY_API || process.env.TAVILY_API_KEY;
if (!TAVILY_API_KEY) {
  console.error("TAVILY_API or TAVILY_API_KEY not found in .env");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- Config ---

const PROVINCES = ["Belluno", "Padova", "Rovigo", "Treviso", "Venezia", "Vicenza", "Verona"];
const PROVINCE_CODES = { belluno: "BL", padova: "PD", rovigo: "RO", treviso: "TV", venezia: "VE", vicenza: "VI", verona: "VR" };
const MONTHS_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

// Exclude domains we already scrape (avoid duplicates from known sources)
const EXCLUDE_DOMAINS = [
  "sagretoday.it", "assosagre.it", "solosagre.com", "sagritaly.it",
  "eventiesagre.it", "itinerarinelgusto.it", "venetoinfesta.it",
  "trovasagre.it", "sagriamo.it", "cheventi.it",
  "facebook.com", "instagram.com", "youtube.com", "tripadvisor.com",
];

// Max searches per run (budget: ~33/day to stay within 1000/month)
const MAX_SEARCHES = 14; // 7 provinces × 2 months

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

function isFoodEvent(title) {
  const t = title.toLowerCase();
  return /\b(sagra|sagre|festa\s+d[ei]l|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia|salsiccia|castagne|zucca|bisi|carciofi|olio|riso|oca|bigoli|cinghiale|trippa|lumache|rane|bufala|focaccia|pinza|prosciutt|salame|pasta|pizza|gelato|dolci|tiramisù|fragol|cilieg|mele|uva|miele|pane|gastronomia|cucina|sapori|gusto|prodotti\s+tipici|street\s*food)\b/i.test(t);
}

// --- Tavily API ---

async function tavilySearch(query) {
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 10,
      exclude_domains: EXCLUDE_DOMAINS,
    }),
  });

  if (!resp.ok) {
    const status = resp.status;
    const body = await resp.text().catch(() => "");
    if (status === 429) throw new Error("Rate limited (429)");
    if (status === 432) throw new Error("Monthly credits exhausted (432)");
    throw new Error(`Tavily API error: HTTP ${status} — ${body.slice(0, 200)}`);
  }

  return await resp.json();
}

// --- Parse sagra info from Tavily result ---

function parseTavilyResult(result, province) {
  const title = result.title || "";
  const content = result.content || "";
  const url = result.url || "";

  // Skip generic listing/calendar pages (not specific events)
  const tLow = title.toLowerCase();
  if (/\b(calendario|esplora|elenco|risposte del modulo|\[xls\]|\[pdf\]|media kit)\b/i.test(tLow)) return null;
  if (/\b(tutti gli|tutte le|scopri le|guida a|le migliori)\b/i.test(tLow)) return null;

  // Skip aggregator/article titles — NOT a specific sagra
  // These are roundup articles listing many events, not a single event page
  if (/\b(sagre|eventi|feste|fiere|festival)\s+(ed?|e|del|della|dei|delle|in|nel|nella|di)\s+(eventi|sagre|feste|fiere|festival|veneto|italia|padova|verona|vicenza|treviso|venezia|rovigo|belluno)\b/i.test(tLow)) return null;
  if (/\beventi\s+enogastronomic/i.test(tLow)) return null;
  if (/\b(le\s+sagre|le\s+feste|gli\s+eventi)\s+(di|del|della|da|vicino|più)\b/i.test(tLow)) return null;
  if (/\b(cosa\s+fare|dove\s+andare|weekend|week\s*end)\b/i.test(tLow)) return null;

  // Must have food keyword in TITLE (not just snippet) to be a specific sagra
  if (!isFoodEvent(title)) return null;

  // Try to extract a clean sagra name from the title
  // Tavily titles often have " - SiteName" or " | SiteName" suffixes
  let cleanTitle = title
    .replace(/\s*[-|–—]\s*[^-|–—]*$/g, "")  // Remove site name suffix
    .replace(/\s*\d{4}\s*$/, "")              // Remove trailing year
    .trim();

  if (cleanTitle.length < 5) cleanTitle = title;
  cleanTitle = cleanTitle.slice(0, 200);

  // Try to extract city from content
  let city = "";
  // Pattern: "a CityName" or "di CityName" or "presso CityName"
  const cityMatch = content.match(/(?:a|di|presso|in)\s+([A-Z][a-zàèéìòù]+(?:\s+[A-Z][a-zàèéìòù]+){0,2})\s*(?:\(|,|\.|\s+\d)/);
  if (cityMatch) city = cityMatch[1].trim();
  if (!city) city = province; // fallback to province name

  // Try to extract dates from content
  let startDate = null;
  // Pattern: "dal DD mese" or "DD mese YYYY" or "DD/MM/YYYY"
  const dateMatch = content.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})?/i);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const monthIdx = MONTHS_IT.indexOf(dateMatch[2].toLowerCase());
    const year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
    if (monthIdx >= 0 && day >= 1 && day <= 31) {
      startDate = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  // Try DD/MM/YYYY format
  if (!startDate) {
    const slashMatch = content.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      startDate = `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`;
    }
  }

  const provinceCode = PROVINCE_CODES[province.toLowerCase()] || null;

  return {
    title: cleanTitle,
    normalizedTitle: normalizeText(cleanTitle),
    slug: generateSlug(cleanTitle, city),
    city,
    startDate,
    endDate: startDate, // best effort — we only get one date from snippets
    sourceUrl: url,
    sourceDescription: content.slice(0, 500) || null,
    contentHash: generateContentHash(cleanTitle, city, startDate),
    province: provinceCode,
  };
}

// --- Main ---

async function discoverSagre() {
  const startedAt = Date.now();
  let searchesMade = 0;
  let totalFound = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentYear = now.getFullYear();

  // Search current month + next month for each province
  const monthsToSearch = [
    { month: MONTHS_IT[currentMonth], year: currentYear },
    { month: MONTHS_IT[(currentMonth + 1) % 12], year: currentMonth === 11 ? currentYear + 1 : currentYear },
  ];

  for (const province of PROVINCES) {
    for (const { month, year } of monthsToSearch) {
      if (searchesMade >= MAX_SEARCHES) {
        console.log(`[tavily] Max searches (${MAX_SEARCHES}) reached, stopping`);
        break;
      }

      const query = `sagra festa enogastronomica ${province} Veneto ${month} ${year}`;
      console.log(`[tavily] Search ${searchesMade + 1}/${MAX_SEARCHES}: "${query}"`);

      let results;
      try {
        const data = await tavilySearch(query);
        results = data.results || [];
        searchesMade++;
      } catch (err) {
        console.error(`[tavily] Search failed:`, err.message);
        if (err.message.includes("432")) {
          console.error("[tavily] Monthly credits exhausted! Stopping.");
          break;
        }
        continue;
      }

      console.log(`[tavily] ${results.length} results for ${province} ${month}`);

      for (const result of results) {
        const parsed = parseTavilyResult(result, province);
        if (!parsed) {
          totalSkipped++;
          continue;
        }

        totalFound++;

        // Dedup check
        const { data: dupes } = await supabase.rpc("find_duplicate_sagra", {
          p_normalized_title: parsed.normalizedTitle,
          p_city: parsed.city.toLowerCase(),
          p_start_date: parsed.startDate,
          p_end_date: parsed.endDate,
        });

        const existing = dupes?.[0];
        if (existing) {
          if (existing.sources?.includes("tavily")) {
            totalSkipped++;
            continue;
          }
          // Merge
          await supabase.from("sagre").update({
            sources: [...(existing.sources ?? []), "tavily"],
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
          totalMerged++;
          console.log(`  Merged: ${parsed.title}`);
          continue;
        }

        // Insert
        const { error } = await supabase.from("sagre").insert({
          title: parsed.title,
          slug: parsed.slug,
          location_text: parsed.city,
          start_date: parsed.startDate,
          end_date: parsed.endDate,
          source_url: parsed.sourceUrl,
          source_description: parsed.sourceDescription,
          sources: ["tavily"],
          is_active: false,
          status: "pending_geocode",
          content_hash: parsed.contentHash,
          province: parsed.province,
        });

        if (error) {
          if (error.code === "23505") {
            const retrySlug = parsed.slug + "-" + Date.now().toString(36);
            await supabase.from("sagre").insert({
              title: parsed.title,
              slug: retrySlug,
              location_text: parsed.city,
              start_date: parsed.startDate,
              end_date: parsed.endDate,
              source_url: parsed.sourceUrl,
              source_description: parsed.sourceDescription,
              sources: ["tavily"],
              is_active: false,
              status: "pending_geocode",
              content_hash: parsed.contentHash + Date.now().toString(36),
              province: parsed.province,
            });
          } else {
            console.error(`  Insert error:`, error.message);
            continue;
          }
        }

        totalInserted++;
        console.log(`  Inserted: ${parsed.title} (${parsed.city})`);
      }

      // Politeness delay between searches
      await new Promise(r => setTimeout(r, 1000));
    }
    if (searchesMade >= MAX_SEARCHES) break;
  }

  // Log run
  await supabase.from("scrape_logs").insert({
    source_id: null,
    source_name: "tavily",
    status: totalInserted > 0 || totalMerged > 0 ? "success" : "skipped",
    events_found: totalFound,
    events_inserted: totalInserted,
    events_merged: totalMerged,
    error_message: `${searchesMade} searches used, ${totalSkipped} non-food skipped`,
    duration_ms: Date.now() - startedAt,
    completed_at: new Date().toISOString(),
  });

  console.log(`\n[tavily] Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  console.log(`[tavily] Searches=${searchesMade}/${MAX_SEARCHES}, Found=${totalFound}, Inserted=${totalInserted}, Merged=${totalMerged}, Skipped=${totalSkipped}`);
  console.log(`[tavily] Credits used: ~${searchesMade} (budget: 1000/month)`);
}

discoverSagre().catch(console.error);
