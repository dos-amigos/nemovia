/**
 * Maps sagra TITLE + food_tags to local fallback images in /public/images/fallback/.
 * Used when a sagra has no image_url from the pipeline.
 * Deterministic selection based on sagra ID for SSR/hydration consistency.
 *
 * Priority: title pattern match → food_tag match → "generico"
 * 33 subjects × 10 variants each = 330 fallback images.
 *
 * Also exports isLowQualityUrl() for detecting known bad/low-res image patterns.
 */

/** Helper to generate the 10 image paths for a subject */
function paths(subject: string): string[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `/images/fallback/${subject}-${n}.jpg`);
}

const SUBJECT_IMAGES: Record<string, string[]> = {
  // Core categories
  carne: paths("carne"),
  pesce: paths("pesce"),
  vino: paths("vino"),
  zucca: paths("zucca"),
  formaggi: paths("formaggi"),
  funghi: paths("funghi"),
  gnocchi: paths("gnocchi"),
  dolci: paths("dolci"),
  verdura: paths("verdura"),
  "prodotti-tipici": paths("prodotti-tipici"),
  generico: paths("generico"),
  // Specific food subjects
  birra: paths("birra"),
  radicchio: paths("radicchio"),
  asparagi: paths("asparagi"),
  polenta: paths("polenta"),
  baccala: paths("baccala"),
  salsiccia: paths("salsiccia"),
  castagne: paths("castagne"),
  mele: paths("mele"),
  fragole: paths("fragole"),
  risotto: paths("risotto"),
  bufala: paths("bufala"),
  oca: paths("oca"),
  focaccia: paths("focaccia"),
  olio: paths("olio"),
  bigoli: paths("bigoli"),
  cinghiale: paths("cinghiale"),
  piselli: paths("piselli"),
  carciofi: paths("carciofi"),
  rane: paths("rane"),
  uva: paths("uva"),
  miele: paths("miele"),
  pasta: paths("pasta"),
};

// =============================================================================
// Title → subject matching (FIRST priority)
// =============================================================================

/** Regex patterns to extract the food subject from a sagra title.
 *  Order matters: more specific patterns first, broader ones last. */
const TITLE_TO_SUBJECT: [RegExp, string][] = [
  // Specific foods
  [/birr[ae]/i, "birra"],
  [/radicchio/i, "radicchio"],
  [/asparag/i, "asparagi"],
  [/polenta/i, "polenta"],
  [/baccalà|baccala|stoccafisso/i, "baccala"],
  [/salsicc/i, "salsiccia"],
  [/castagne|castagna|marroni/i, "castagne"],
  [/mele\b|mela\b|miele?\s*e\s*mel/i, "mele"],
  [/fragol/i, "fragole"],
  [/risotto/i, "risotto"],
  [/bufal/i, "bufala"],
  [/\boca\b|dell'oca|dell'oca/i, "oca"],
  [/focaccia|pinza\b|pinzin/i, "focaccia"],
  [/\bolio\b|oliv/i, "olio"],
  [/bigol/i, "bigoli"],
  [/cinghiale/i, "cinghiale"],
  [/piselli|\bbisi\b/i, "piselli"],
  [/carciofi|carciofo/i, "carciofi"],
  [/\bran[ae]\b|delle\s+rane/i, "rane"],
  [/\buva\b|vendemmia/i, "uva"],
  [/\bmiele\b/i, "miele"],
  [/\bpasta\b|bigoli|tagliatelle|pappardelle/i, "pasta"],
  [/fagiol/i, "verdura"],
  [/patat[ae]/i, "verdura"],
  [/lenticch/i, "verdura"],
  // Broader categories (check after specific)
  [/gnocch/i, "gnocchi"],
  [/fungh/i, "funghi"],
  [/zucc[ah]/i, "zucca"],
  [/pesce|frutti.*mare|mare.*frutti|sarde|sardella|\banguilla\b/i, "pesce"],
  [/carne|grigliata|barbecue|griglia/i, "carne"],
  [/\briso\b/i, "risotto"],
  [/vino\b/i, "vino"],
  [/formaggio|formaggi|caseus/i, "formaggi"],
  [/dolci|torta\b|frittelle|galani|fritola/i, "dolci"],
  [/pane\b|panettone/i, "focaccia"],
  [/prodotti?\s*tipic/i, "prodotti-tipici"],
];

// =============================================================================
// Food tag → subject mapping (SECOND priority)
// =============================================================================

const TAG_TO_SUBJECT: Record<string, string> = {
  Carne: "carne",
  Pesce: "pesce",
  Vino: "vino",
  Zucca: "zucca",
  Formaggi: "formaggi",
  Funghi: "funghi",
  Gnocchi: "gnocchi",
  Dolci: "dolci",
  Pane: "focaccia",
  Radicchio: "radicchio",
  Verdura: "verdura",
  "Prodotti Tipici": "prodotti-tipici",
};

/** Priority when multiple food_tags match (higher = preferred) */
const TAG_PRIORITY: Record<string, number> = {
  carne: 6,
  pesce: 5,
  zucca: 4,
  gnocchi: 3,
  funghi: 3,
  radicchio: 3,
  vino: 2,
  formaggi: 2,
  dolci: 2,
  focaccia: 2,
  verdura: 1,
  "prodotti-tipici": 1,
};

// =============================================================================
// Low-quality / bad image URL detection
// =============================================================================

const BAD_IMAGE_PATTERNS: RegExp[] = [
  /spacer\.(gif|png)/i,
  /pixel\.(gif|png)/i,
  /1x1\.(gif|png|jpg)/i,
  /blank\.(gif|png|jpg)/i,
  /transparent\.(gif|png)/i,
  /no[-_]?image/i,
  /no[-_]?photo/i,
  /no[-_]?pic/i,
  /default[-_]?(image|img|photo|thumb)/i,
  /placeholder/i,
  /coming[-_]?soon/i,
  /image[-_]?not[-_]?found/i,
  /missing[-_]?(image|photo)/i,
  /\blogo[-_]?(sito|site|header|footer|main)?\b.*\.(png|jpg|svg|gif|webp)$/i,
  /\bfavicon\b/i,
  /\bicon[-_]?\d*\.(png|ico|svg)/i,
  /wp-content\/plugins\/.*placeholder/i,
  /woocommerce-placeholder/i,
  /[/_-](thumb|thumbnail|small|mini|micro|tiny|icon)[/_.-]/i,
  /\/thumbs?\//i,
  /\/thumbnails?\//i,
  /\/miniature?\//i,
  /^data:image/i,
  /[?&]w(idth)?=([1-9]\d{0,1}|[1-3]\d{2}|400)(&|$)/,
  /[?&]h(eight)?=([1-9]\d{0,1}|[1-3]\d{2}|400)(&|$)/,
  /-(\d{1,2}|[1-3]\d{2}|400)x(\d{1,2}|[1-3]\d{2}|400)\.\w+$/,
  /\/resize\/([1-3]\d{2}|[1-9]\d?)\//i,
  /[=]s([1-3]\d{2}|[1-9]\d?)(&|$)/,
  /eventiesagre\.it\/.*\/immagini\/thumb/i,
  /assosagre\.it\/.*\/thumb/i,
  /sagritaly\.it\/.*_small/i,
  /solosagre\.com\/.*\/s\//i,
];

export function isLowQualityUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  for (const pattern of BAD_IMAGE_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  return false;
}

// =============================================================================
// Deterministic fallback image selection
// =============================================================================

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Get a fallback image path for a sagra without an image_url.
 * Priority: title pattern → food_tags → "generico".
 * Selection is deterministic (hash of sagraId) for SSR consistency.
 */
export function getFallbackImage(
  sagraId: string,
  foodTags?: string[] | null,
  title?: string | null,
): string {
  let subject = "generico";

  // 1. Try to match from title (most specific)
  if (title) {
    for (const [pattern, subj] of TITLE_TO_SUBJECT) {
      if (pattern.test(title)) {
        subject = subj;
        break;
      }
    }
  }

  // 2. If title didn't match, try food_tags
  if (subject === "generico" && foodTags && foodTags.length > 0) {
    let bestPriority = -1;
    for (const tag of foodTags) {
      const mapped = TAG_TO_SUBJECT[tag];
      if (mapped) {
        const priority = TAG_PRIORITY[mapped] ?? 0;
        if (priority > bestPriority) {
          bestPriority = priority;
          subject = mapped;
        }
      }
    }
  }

  const images = SUBJECT_IMAGES[subject] ?? SUBJECT_IMAGES.generico;
  const index = hashString(sagraId) % images.length;
  return images[index];
}
