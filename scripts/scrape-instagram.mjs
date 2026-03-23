// =============================================================================
// scrape-instagram.mjs — Discover sagre from Instagram Pro Loco pages via Apify
// Uses Apify Instagram Scraper to fetch recent posts, then Gemini Vision to
// extract event data from locandine (flyer images).
// Run: node scripts/scrape-instagram.mjs
// Budget: ~80 posts/run × $0.0015/post = ~$0.12/run. At 2x/week = ~$1/month.
// =============================================================================

import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const APIFY_TOKEN = process.env.APIFY_API || process.env.APIFY_TOKEN;
if (!APIFY_TOKEN) {
  console.error("APIFY_API or APIFY_TOKEN not found in .env");
  process.exit(1);
}

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROQ_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GROQ_API_KEY && !GEMINI_API_KEY) {
  console.error("Neither GROQ_API_KEY nor GEMINI_API_KEY found in .env");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- Config ---

// Instagram profiles: read from DB (external_sources), fallback to hardcoded
const FALLBACK_INSTAGRAM_PROFILES = [
  "https://www.instagram.com/sagreveneto/",
  "https://www.instagram.com/sagreinveneto/",
  "https://www.instagram.com/unpliveneto/",
  "https://www.instagram.com/venetoinfesta/",
];

async function loadInstagramProfiles() {
  try {
    const { data } = await supabase
      .from("external_sources")
      .select("url")
      .eq("type", "instagram")
      .eq("is_active", true);
    if (data && data.length > 0) {
      console.log(`[ig] Loaded ${data.length} profiles from DB`);
      return data.map((r) => r.url);
    }
  } catch (e) {
    console.warn("[ig] Could not load from external_sources, using fallback:", e.message);
  }
  console.log(`[ig] Using ${FALLBACK_INSTAGRAM_PROFILES.length} hardcoded profiles`);
  return FALLBACK_INSTAGRAM_PROFILES;
}

const POSTS_PER_PROFILE = 15; // Recent posts to check (locandine are usually recent)
const MAX_DAYS_OLD = 60;       // Skip posts older than 60 days

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

const PROVINCE_CODES = {
  belluno: "BL", padova: "PD", rovigo: "RO", treviso: "TV",
  venezia: "VE", vicenza: "VI", verona: "VR",
};

function detectProvince(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const [name, code] of Object.entries(PROVINCE_CODES)) {
    if (t.includes(name)) return code;
  }
  const codeMatch = t.match(/\b(bl|pd|ro|tv|ve|vi|vr)\b/i);
  if (codeMatch) return codeMatch[1].toUpperCase();
  return null;
}

function isFoodEvent(title) {
  return /\b(sagra|sagre|festa\s+d[ei]l|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia|salsiccia|castagne|zucca|bisi|carciofi|olio|riso|oca|bigoli|cinghiale|trippa|lumache|rane|bufala|focaccia|pinza|prosciutt|salame|pasta|pizza|gelato|dolci|tiramisù|fragol|cilieg|mele|uva|miele|pane|gastronomia|cucina|sapori|gusto|prodotti\s+tipici|street\s*food)\b/i.test(title);
}

// --- Vision API: Groq (primary) → Gemini (fallback) ---

const VISION_PROMPT = `Sei un esperto di sagre e feste del cibo in Veneto (Italia).

Analizza questa immagine (una locandina/volantino di un evento) e il testo del post Instagram.

Estrai SOLO se è una sagra/festa del cibo. Se NON è un evento gastronomico, rispondi con: {"is_sagra": false}

Se È una sagra, estrai questi dati in JSON:
{
  "is_sagra": true,
  "title": "Nome completo della sagra/festa",
  "city": "Nome del comune/paese (NO provincia)",
  "province": "Codice provincia 2 lettere (BL/PD/RO/TV/VE/VI/VR) o null",
  "start_date": "YYYY-MM-DD o null",
  "end_date": "YYYY-MM-DD o null",
  "description": "Breve descrizione (max 200 caratteri)",
  "food_tags": ["tag1", "tag2"],
  "is_free": true/false/null
}

REGOLE:
- Solo sagre in VENETO
- Date nel formato YYYY-MM-DD (anno corrente se non specificato: 2026)
- food_tags: Pesce, Carne, Vino, Formaggi, Funghi, Radicchio, Zucca, Dolci, Pane, Verdura, Prodotti Tipici
- Se non riesci a determinare un campo, usa null
- Rispondi SOLO con il JSON, nessun altro testo`;

async function analyzeImageWithGroq(imageUrl, caption) {
  if (!GROQ_API_KEY) return null;
  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `${VISION_PROMPT}\n\nTesto post: "${caption || "nessun testo"}"` },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.warn(`[groq-vision] HTTP ${resp.status}: ${errText.slice(0, 200)}`);
      return null; // fallback to Gemini
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const result = JSON.parse(jsonMatch[0]);
    result._provider = "groq";
    return result;
  } catch (err) {
    console.warn(`[groq-vision] Error: ${err.message}`);
    return null;
  }
}

async function analyzeImageWithGemini(imageUrl, caption) {
  if (!GEMINI_API_KEY) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `${VISION_PROMPT}\n\nTesto post: "${caption || "nessun testo"}"` },
            { inline_data: { mime_type: "image/jpeg", data: await fetchImageAsBase64(imageUrl) } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      if (resp.status === 429) {
        console.warn("[gemini] Rate limited, skipping");
        return null;
      }
      console.error(`[gemini] HTTP ${resp.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const result = JSON.parse(jsonMatch[0]);
    result._provider = "gemini";
    return result;
  } catch (err) {
    console.error(`[gemini] Error:`, err.message);
    return null;
  }
}

/** Groq Vision (fast, free) → Gemini Vision (fallback) */
async function analyzeImage(imageUrl, caption) {
  // Try Groq first (sends URL directly, no base64 needed)
  const groqResult = await analyzeImageWithGroq(imageUrl, caption);
  if (groqResult) return groqResult;
  // Fallback to Gemini (needs base64)
  return analyzeImageWithGemini(imageUrl, caption);
}

async function fetchImageAsBase64(imageUrl) {
  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
  const buffer = await resp.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

// --- Apify Instagram Scraper ---

async function scrapeInstagramPosts() {
  console.log("[apify] Starting Instagram scrape...");
  const client = new ApifyClient({ token: APIFY_TOKEN });

  const INSTAGRAM_PROFILES = await loadInstagramProfiles();

  const input = {
    directUrls: INSTAGRAM_PROFILES,
    resultsType: "posts",
    resultsLimit: POSTS_PER_PROFILE,
  };

  console.log(`[apify] Scraping ${INSTAGRAM_PROFILES.length} profiles, ${POSTS_PER_PROFILE} posts each`);

  const run = await client.actor("apify/instagram-scraper").call(input, {
    waitSecs: 300, // Wait up to 5 minutes
  });

  console.log(`[apify] Run finished: ${run.status}, dataset: ${run.defaultDatasetId}`);

  if (run.status !== "SUCCEEDED") {
    throw new Error(`Apify run failed with status: ${run.status}`);
  }

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`[apify] Got ${items.length} posts total`);

  return items;
}

// --- Main pipeline ---

async function main() {
  const startedAt = Date.now();
  let totalPosts = 0;
  let totalAnalyzed = 0;
  let totalSagre = 0;
  let totalInserted = 0;
  let totalMerged = 0;
  let totalSkipped = 0;

  // Step 1: Fetch Instagram posts via Apify
  let posts;
  try {
    posts = await scrapeInstagramPosts();
  } catch (err) {
    console.error("[apify] Failed:", err.message);
    await logRun("error", 0, 0, 0, err.message, startedAt);
    return;
  }

  totalPosts = posts.length;

  // Step 2: Filter recent posts with images
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_DAYS_OLD);

  const recentPosts = posts.filter(post => {
    if (!post.displayUrl && !post.imageUrl) return false;
    if (post.timestamp) {
      const postDate = new Date(post.timestamp);
      if (postDate < cutoffDate) return false;
    }
    return true;
  });

  console.log(`[pipeline] ${recentPosts.length} recent posts with images (of ${totalPosts} total)`);

  // Step 3: Pre-filter by caption (food keywords) — saves Gemini credits
  const candidatePosts = recentPosts.filter(post => {
    const text = `${post.caption || ""} ${post.alt || ""}`.toLowerCase();
    // Must mention food/sagra keywords in caption OR have no caption (image-only = locandina)
    if (!post.caption || post.caption.length < 10) return true; // No caption = might be locandina
    return isFoodEvent(text);
  });

  console.log(`[pipeline] ${candidatePosts.length} candidate food posts after caption filter`);

  // Step 4: Analyze each candidate with Gemini Vision
  for (const post of candidatePosts) {
    const imageUrl = post.displayUrl || post.imageUrl;
    if (!imageUrl) continue;

    console.log(`[pipeline] Analyzing: ${(post.caption || "no caption").slice(0, 60)}...`);
    totalAnalyzed++;

    // Rate limit: 3s between vision calls to stay under Groq TPM limit
    if (totalAnalyzed > 1) await new Promise(r => setTimeout(r, 3000));

    const result = await analyzeImage(imageUrl, post.caption);
    if (!result || !result.is_sagra) {
      console.log(`  → Not a sagra`);
      totalSkipped++;
      continue;
    }

    totalSagre++;
    const title = (result.title || "").slice(0, 200);
    if (!title || title.length < 5) {
      console.log(`  → No title extracted`);
      totalSkipped++;
      continue;
    }

    const city = result.city || "";
    const province = result.province || detectProvince(`${city} ${post.locationName || ""}`);
    const startDate = result.start_date || null;
    const endDate = result.end_date || startDate;

    console.log(`  → Sagra: "${title}" at ${city} (${province}) ${startDate || "no date"}`);

    // Dedup check
    const normalizedTitle = normalizeText(title);
    const { data: dupes } = await supabase.rpc("find_duplicate_sagra", {
      p_normalized_title: normalizedTitle,
      p_city: city.toLowerCase(),
      p_start_date: startDate,
      p_end_date: endDate,
    });

    const existing = dupes?.[0];
    if (existing) {
      if (existing.sources?.includes("instagram")) {
        totalSkipped++;
        continue;
      }
      // Merge: add instagram as source, add image if missing
      await supabase.from("sagre").update({
        image_url: existing.image_url ?? imageUrl,
        sources: [...(existing.sources ?? []), "instagram"],
        source_description: existing.source_description ?? (result.description || null),
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      totalMerged++;
      console.log(`  → Merged with existing`);
      continue;
    }

    // Insert new sagra
    const slug = generateSlug(title, city || "veneto");
    const contentHash = generateContentHash(title, city || "veneto", startDate);

    const insertData = {
      title,
      slug,
      location_text: city || "Veneto",
      start_date: startDate,
      end_date: endDate || startDate,
      image_url: imageUrl, // Instagram image = the locandina itself!
      source_url: post.url || null,
      source_description: result.description || post.caption?.slice(0, 500) || null,
      sources: ["instagram"],
      is_active: false,
      status: "pending_geocode",
      content_hash: contentHash,
      province: province,
      food_tags: result.food_tags || null,
      is_free: result.is_free ?? null,
    };

    const { error } = await supabase.from("sagre").insert(insertData);
    if (error) {
      if (error.code === "23505") {
        insertData.slug = slug + "-" + Date.now().toString(36);
        insertData.content_hash = contentHash + Date.now().toString(36);
        await supabase.from("sagre").insert(insertData);
      } else {
        console.error(`  → Insert error:`, error.message);
        continue;
      }
    }

    totalInserted++;
    console.log(`  → Inserted!`);

    // Rate limit Gemini (flash-lite: 1000 RPD, ~1 req/1.5s to be safe)
    await new Promise(r => setTimeout(r, 2000));
  }

  await logRun(
    totalInserted > 0 || totalMerged > 0 ? "success" : "skipped",
    totalSagre, totalInserted, totalMerged,
    `${totalPosts} posts, ${totalAnalyzed} analyzed, ${totalSkipped} skipped`,
    startedAt
  );

  console.log(`\n[instagram] Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  console.log(`[instagram] Posts=${totalPosts}, Analyzed=${totalAnalyzed}, Sagre=${totalSagre}, Inserted=${totalInserted}, Merged=${totalMerged}, Skipped=${totalSkipped}`);
}

async function logRun(status, found, inserted, merged, message, startedAt) {
  const completedAt = new Date().toISOString();
  await supabase.from("scrape_logs").insert({
    source_id: null,
    source_name: "instagram",
    status,
    events_found: found,
    events_inserted: inserted,
    events_merged: merged,
    error_message: message,
    duration_ms: Date.now() - startedAt,
    completed_at: completedAt,
  });

  // Update last_scraped_at on all active instagram sources
  await supabase.from("external_sources")
    .update({ last_scraped_at: completedAt, last_result: { found, inserted, merged, errors: message ? 1 : 0 } })
    .eq("type", "instagram").eq("is_active", true);
}

main().catch(console.error);
