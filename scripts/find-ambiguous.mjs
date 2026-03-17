import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const res = await fetch(
  `${url}/rest/v1/sagre?is_active=eq.true&select=id,title,food_tags,enhanced_description,source_description&order=title`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } }
);
const data = await res.json();

const foodPatterns = [
  /birr[ae]/i, /radicchio/i, /asparag/i, /polenta/i, /baccalà|baccala|stoccafisso/i,
  /salsicc/i, /castagne|castagna|marroni/i, /mele\b|mela\b/i, /fragol/i, /risotto/i,
  /bufal/i, /\boca\b|dell.oca/i, /focaccia|pinza\b|pinzin/i, /\bolio\b|oliv/i,
  /bigol/i, /cinghiale/i, /piselli|\bbisi\b/i, /carciofi|carciofo/i,
  /\bran[ae]\b|delle\s+rane/i, /\buva\b|vendemmia/i, /\bmiele\b/i,
  /\bpasta\b|tagliatelle|pappardelle/i, /fagiol/i, /patat[ae]/i, /lenticch/i,
  /gnocch/i, /fungh/i, /zucc[ah]/i, /pesce|frutti.*mare|sarde|\banguilla\b/i,
  /carne|grigliata|barbecue|griglia/i, /\briso\b/i, /vino\b/i,
  /formaggio|formaggi|caseus/i, /dolci|torta\b|frittelle|galani|fritola/i,
  /pane\b|panettone/i, /prodotti?\s*tipic/i,
];

const hasFoodInTitle = (title) => foodPatterns.some((p) => p.test(title));
const hasFoodInDesc = (desc) => foodPatterns.some((p) => p.test(desc));

const ambiguous = data.filter((s) => !hasFoodInTitle(s.title));

console.log(`Totale sagre attive: ${data.length}`);
console.log(`Sagre con cibo nel titolo: ${data.length - ambiguous.length}`);
console.log(`Sagre AMBIGUE (no food in title): ${ambiguous.length}\n`);

for (const s of ambiguous) {
  const desc = s.enhanced_description || s.source_description || "";
  const shortDesc = desc.substring(0, 150);
  const descMatch = hasFoodInDesc(desc) ? "YES" : "NO";
  console.log(`${s.id} | ${s.title}`);
  console.log(`   tags: ${JSON.stringify(s.food_tags)}`);
  console.log(`   desc food match: ${descMatch}`);
  console.log(`   desc: ${shortDesc}`);
  console.log();
}
