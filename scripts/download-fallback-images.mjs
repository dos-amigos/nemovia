/**
 * Downloads 10 high-quality food images per subject from Pexels.
 * Saves to /public/images/fallback/{subject}-{1..10}.jpg
 *
 * Usage: node scripts/download-fallback-images.mjs
 * Requires: PEXELS_API in .env
 */

import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

const API_KEY = process.env.PEXELS_API;
if (!API_KEY) {
  console.error("PEXELS_API not found in .env");
  process.exit(1);
}

const OUTPUT_DIR = resolve(__dirname, "../public/images/fallback");

/**
 * Subject → Pexels search query.
 * Queries MUST be ultra-specific to the FOOD item visible in the photo.
 * NEVER generic ("Italian food", "rustic table", "market") — always the ACTUAL ingredient.
 */
const SUBJECTS = {
  // === Core categories ===
  carne: "grilled steak meat close up",
  pesce: "fresh fish fillet seafood plate",
  vino: "red wine glass close up",
  zucca: "pumpkin soup bowl close up",
  formaggi: "aged cheese wheel parmesan close up",
  funghi: "porcini mushroom dish close up",
  gnocchi: "potato gnocchi pasta sauce plate",
  dolci: "tiramisu Italian dessert close up",
  verdura: "fresh colorful vegetables close up",
  "prodotti-tipici": "salami cheese charcuterie board close up",
  generico: "Italian pasta dish table close up",

  // === Specific food subjects ===
  birra: "draft beer glass foam close up",
  radicchio: "radicchio treviso red leaf close up",
  asparagi: "green asparagus bunch close up",
  polenta: "yellow polenta corn dish",
  baccala: "cod fish fillet cooked plate",
  salsiccia: "grilled sausage close up",
  castagne: "roasted chestnuts close up",
  mele: "red apples close up fresh",
  fragole: "fresh strawberries close up red",
  risotto: "creamy risotto plate close up",
  bufala: "fresh mozzarella ball close up",
  oca: "roasted goose duck poultry dinner",
  focaccia: "focaccia bread rosemary close up",
  olio: "olive oil pouring close up",
  bigoli: "fresh egg pasta noodles close up",
  cinghiale: "meat ragu stew close up",
  piselli: "green peas bowl close up",
  carciofi: "artichoke grilled close up",
  rane: "fried frog legs plate",
  uva: "purple grapes close up bunch",
  miele: "honey jar golden dripping close up",
  pasta: "spaghetti pasta tomato sauce close up",
};

const TOTAL_PER_SUBJECT = 10;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchPexels(query, perPage = 10) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;
  const res = await fetch(url, {
    headers: { Authorization: API_KEY },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pexels API ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.photos || [];
}

async function downloadImage(imageUrl, filepath) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${imageUrl}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(filepath, buffer);
  return buffer.length;
}

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  const subjects = Object.entries(SUBJECTS);
  console.log(`Downloading ${subjects.length} subjects x ${TOTAL_PER_SUBJECT} images = ${subjects.length * TOTAL_PER_SUBJECT} total\n`);

  let totalDownloaded = 0;
  let totalFailed = 0;
  let apiCalls = 0;

  for (const [subject, query] of subjects) {
    process.stdout.write(`[${subject}] "${query}" ... `);

    try {
      const results = await searchPexels(query, TOTAL_PER_SUBJECT);
      apiCalls++;

      if (results.length === 0) {
        console.log("NO RESULTS");
        totalFailed += TOTAL_PER_SUBJECT;
        continue;
      }

      let ok = 0;
      for (let i = 0; i < Math.min(results.length, TOTAL_PER_SUBJECT); i++) {
        const photo = results[i];
        const imageUrl = photo.src.landscape || photo.src.large;
        const filepath = resolve(OUTPUT_DIR, `${subject}-${i + 1}.jpg`);

        try {
          await downloadImage(imageUrl, filepath);
          ok++;
        } catch {
          totalFailed++;
        }
      }
      totalDownloaded += ok;
      console.log(`${ok}/${TOTAL_PER_SUBJECT} OK`);

      await delay(200);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      totalFailed += TOTAL_PER_SUBJECT;

      if (err.message.includes("429")) {
        console.log("Rate limited! Waiting 60s...");
        await delay(60000);
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`Done! ${totalDownloaded} downloaded, ${totalFailed} failed`);
  console.log(`API calls: ${apiCalls} (limit: 200/hour)`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch(console.error);
