/**
 * LLM enrichment helper functions for the enrichment pipeline.
 * Pure functions — no API calls, no external dependencies.
 * These are copied verbatim into supabase/functions/enrich-sagre/index.ts
 * because Deno Edge Functions cannot import from the Next.js src/ directory.
 */

export const FOOD_TAGS = [
  "Pesce",
  "Carne",
  "Vino",
  "Formaggi",
  "Funghi",
  "Radicchio",
  "Dolci",
  "Prodotti Tipici",
] as const;

export const FEATURE_TAGS = [
  "Gratis",
  "Musica",
  "Artigianato",
  "Bambini",
  "Tradizionale",
] as const;

export type FoodTag = typeof FOOD_TAGS[number];
export type FeatureTag = typeof FEATURE_TAGS[number];

/** Default batch size: 8 sagre per Gemini call. Stays well within 250 RPD. */
export const BATCH_SIZE = 8;

/** Maximum characters for LLM-generated descriptions. */
export const MAX_DESC_CHARS = 250;

/**
 * Filter an array of tag strings to only those present in the allowed enum.
 * Gemini structured output guarantees JSON syntax but not strict enum compliance.
 */
export function validateTags<T extends string>(
  tags: string[],
  allowedTags: readonly T[]
): T[] {
  return tags.filter((t): t is T => (allowedTags as readonly string[]).includes(t));
}

/**
 * Truncate a description to MAX_DESC_CHARS characters.
 * Ensures LLM output respects the UI character limit regardless of model behavior.
 */
export function truncateDescription(text: string): string {
  return text.slice(0, MAX_DESC_CHARS);
}

/**
 * Split an array into chunks of at most `size` items.
 * Used to batch sagre into Gemini API calls (PIPE-09: 5-10 per call).
 */
export function chunkBatch<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export interface SagraForEnrichment {
  id: string;
  title: string;
  location_text: string;
  description: string | null;
}

/**
 * Enrichment result from Gemini structured output.
 * Includes is_sagra classification to filter non-sagra events (DQ-07/DQ-08).
 */
export interface EnrichmentResult {
  id: string;
  is_sagra: boolean;
  food_tags: string[];
  feature_tags: string[];
  enhanced_description: string;
}

/**
 * Build the Italian-language Gemini prompt for a batch of events.
 * Returns consistent prompt text that includes the allowed tag lists
 * and is_sagra classification instruction (DQ-07/DQ-08).
 */
export function buildEnrichmentPrompt(batch: SagraForEnrichment[]): string {
  return `Sei un esperto di sagre italiane. Per ogni evento nella lista JSON, genera:
1. is_sagra: true se l'evento e una sagra, festa del cibo, o fiera gastronomica. false se e antiquariato, mostra, mercato generico, concerto, evento sportivo, o altro evento non gastronomico. Se l'evento ha una componente gastronomica significativa (cibo, degustazione, prodotti tipici), classificalo come sagra anche se ha altri elementi (musica, artigianato).
2. food_tags: array con i tag alimentari pertinenti (max 3) scelti SOLO da: ${FOOD_TAGS.join(", ")}
3. feature_tags: array con i tag caratteristici (max 2) scelti SOLO da: ${FEATURE_TAGS.join(", ")}
4. enhanced_description: descrizione coinvolgente in italiano, max ${MAX_DESC_CHARS} caratteri, che menzioni il cibo principale e l'atmosfera

EVENTI:
${JSON.stringify(batch)}

Rispondi con un array JSON, un oggetto per ogni evento con: id, is_sagra, food_tags, feature_tags, enhanced_description.`;
}
