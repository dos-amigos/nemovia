# Phase 15: Deduplication & Classification - Research

**Researched:** 2026-03-10
**Domain:** PostgreSQL fuzzy matching (pg_trgm), LLM classification (Gemini 2.5 Flash), image URL manipulation, React placeholder components
**Confidence:** HIGH

## Summary

Phase 15 addresses five requirements across three distinct technical domains: (1) fuzzy deduplication via PostgreSQL pg_trgm extension, (2) LLM-based sagra/non-sagra classification within the existing Gemini enrichment pipeline, and (3) image quality improvements (URL upgrades + branded placeholders).

All three domains build on existing infrastructure. The pg_trgm extension is a built-in PostgreSQL extension available on all Supabase tiers -- it adds fuzzy `similarity()` matching to the existing `find_duplicate_sagra` RPC. The LLM classification adds a single `is_sagra: BOOLEAN` field to the existing Gemini structured output schema, costing zero additional API calls. Image upgrades use URL string manipulation at scrape time (source-specific thumbnail-to-full patterns), and the placeholder is a CSS/SVG component replacing the current grey gradient.

**Primary recommendation:** Enable pg_trgm extension in the `extensions` schema (matching the project's convention for PostGIS and unaccent), upgrade the `find_duplicate_sagra` RPC with similarity thresholds, add `is_sagra` to the Gemini enrichment prompt, and add a `tryUpgradeImageUrl()` function to the scrape pipeline. All changes are in Edge Functions and SQL -- zero new npm packages.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DQ-06 | Pipeline rileva e disattiva duplicati tramite fuzzy matching (pg_trgm similarity) su titolo e localita | pg_trgm `similarity()` function with GIN index on normalized_title; upgrade `find_duplicate_sagra` RPC; retroactive dedup SQL |
| DQ-07 | Pipeline classifica ogni evento come sagra/non-sagra tramite LLM (Gemini is_sagra) e disattiva i non-sagre | Add `is_sagra: BOOLEAN` to existing Gemini structured output schema in enrichment prompt; deactivate when false |
| DQ-08 | La classificazione LLM non genera chiamate API aggiuntive (campo aggiunto al prompt di enrichment esistente) | Boolean field rides existing batch Gemini calls -- zero additional API calls; verified via structured output schema |
| DQ-09 | Pipeline tenta upgrade delle immagini a risoluzione maggiore tramite pattern URL source-specifici | WordPress `-WxH` suffix removal for sagritaly; URL pattern analysis for other sources; `tryUpgradeImageUrl()` in scrape pipeline |
| DQ-10 | Card mostra placeholder gradevole quando l'immagine non e disponibile o e troppo piccola | Replace current `bg-gradient-to-br from-amber-100 to-green-100` with branded SVG/CSS placeholder; apply in SagraCard and SagraDetail |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg_trgm | Built-in PostgreSQL | Trigram-based fuzzy text matching | Server-side similarity matching in SQL, GIN-indexed, no JS dependency; available on all Supabase tiers |
| Gemini 2.5 Flash | @google/genai@1 | LLM classification (is_sagra boolean) | Already used for enrichment; boolean field in structured output is supported and costs zero additional API calls |
| Next.js Image | next@15.5.12 | Image optimization | Already handles remote image resize/compress/WebP; `hostname: "**"` already configured |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.0.18 | Unit testing | Test image URL upgrade patterns, dedup logic |
| Supabase CLI | Already linked | Deploy Edge Function changes | When updating scrape-sagre and enrich-sagre |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg_trgm (PostgreSQL) | string-similarity (npm) | Client-side matching against 700+ rows is wasteful; pg_trgm runs where data lives, GIN-indexed |
| pg_trgm (PostgreSQL) | fastest-levenshtein (npm) | Same problem; also needs vendoring into Deno Edge Function |
| URL manipulation for images | Detail page scraping for og:image | HIGH effort, adds 5-10min per scraper run, explicitly out of scope in REQUIREMENTS.md |
| CSS/SVG placeholder | @plaiceholder or blur-hash | Requires server-side image processing and additional npm package; overkill for a static branded placeholder |

**Installation:**
```sql
-- Enable pg_trgm in Supabase SQL Editor (one-time)
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
```

No npm packages to install. Zero new dependencies.

## Architecture Patterns

### Recommended Project Structure

No new files/directories needed beyond what exists. Changes are surgical modifications to existing files:

```
supabase/
  functions/
    scrape-sagre/index.ts       # Add tryUpgradeImageUrl(), retroactive dedup call
    enrich-sagre/index.ts       # Add is_sagra to Gemini schema, deactivate non-sagre
  migrations/
    007_dedup_classification.sql # pg_trgm, GIN index, upgraded RPC, retroactive dedup+classify
src/
  components/
    sagra/SagraCard.tsx          # Replace placeholder gradient with branded SVG
    detail/SagraDetail.tsx       # Same placeholder update
  lib/
    scraper/filters.ts           # Add tryUpgradeImageUrl() pure function (canonical)
    scraper/__tests__/
      filters.test.ts            # Tests for image URL upgrade patterns
  lib/
    enrichment/llm.ts            # Add is_sagra to prompt builder + response type
    enrichment/__tests__/
      llm.test.ts                # Update prompt test to verify is_sagra field
```

### Pattern 1: Fuzzy Deduplication with pg_trgm

**What:** Upgrade the existing `find_duplicate_sagra` RPC to use trigram similarity matching in addition to exact normalized title comparison. This catches near-duplicates that differ in minor wording (e.g., "Sagra del Pesce" vs "Sagra del Pesce Fresco").

**When to use:** At scrape time, during the `upsertEvent()` call which already invokes this RPC.

**Critical: Schema qualification on Supabase.** There is a known issue where pg_trgm functions are not found if the extension is created in a different schema than the calling context. The project creates extensions in the `extensions` schema (PostGIS, unaccent, pg_net). For pg_trgm, either:
- Create in the `extensions` schema and use `extensions.similarity()` in the RPC, OR
- Create in the `public` schema (simpler, since the RPC is in `public`)

**Recommendation:** Create pg_trgm in the `extensions` schema (consistent with project convention) and use fully-qualified `extensions.similarity()` calls in the RPC.

**Example (upgraded find_duplicate_sagra):**
```sql
-- Source: PostgreSQL pg_trgm docs + project convention
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- GIN index on normalized_title for fast trigram lookups
CREATE INDEX IF NOT EXISTS idx_sagre_title_trgm
  ON public.sagre USING gin (normalized_title extensions.gin_trgm_ops);

-- Upgraded RPC with fuzzy matching
CREATE OR REPLACE FUNCTION public.find_duplicate_sagra(
  p_normalized_title TEXT,
  p_city TEXT,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  image_url TEXT,
  price_info TEXT,
  is_free BOOLEAN,
  sources TEXT[]
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.image_url, s.price_info, s.is_free, s.sources
  FROM public.sagre s
  WHERE s.is_active = true
    AND (
      -- Title match: exact OR fuzzy (similarity > 0.6)
      s.normalized_title = p_normalized_title
      OR extensions.similarity(s.normalized_title, p_normalized_title) > 0.6
    )
    AND (
      -- City match: exact OR fuzzy (similarity > 0.5)
      lower(s.location_text) = p_city
      OR extensions.similarity(lower(s.location_text), p_city) > 0.5
    )
    AND (
      -- Date overlap or either side has no dates
      (p_start_date IS NOT NULL AND s.start_date IS NOT NULL
       AND daterange(s.start_date, COALESCE(s.end_date, s.start_date), '[]')
           && daterange(p_start_date, COALESCE(p_end_date, p_start_date), '[]'))
      OR (p_start_date IS NULL OR s.start_date IS NULL)
    )
  ORDER BY extensions.similarity(s.normalized_title, p_normalized_title) DESC
  LIMIT 1;
END;
$$;
```

**Similarity thresholds:**
- Title: 0.6 (moderately strict -- catches "Sagra del Pesce" vs "Sagra del Pesce Fresco" but not "Sagra del Vino" vs "Sagra della Polenta")
- City: 0.5 (looser -- catches "San Dona di Piave" vs "San Dona' di Piave" with accent differences)

These are starting estimates. The initial architecture research suggested these values and they align with pg_trgm's default `word_similarity_threshold` of 0.6. Tuning may be needed after analyzing actual duplicate patterns.

### Pattern 2: LLM Classification (is_sagra) in Existing Enrichment

**What:** Add an `is_sagra: BOOLEAN` field to the Gemini structured output schema in `buildEnrichmentPrompt()`. The LLM already receives the event title, location, and description. Adding classification is a prompt text change + schema field -- zero additional API calls.

**When to use:** During the existing LLM enrichment pass (Pass 2 of enrich-sagre).

**Example (modified enrichment prompt):**
```typescript
// Source: Existing enrich-sagre/index.ts pattern + Gemini structured output docs
function buildEnrichmentPrompt(batch: SagraForLLM[]): string {
  return `Sei un esperto di sagre italiane. Per ogni evento nella lista JSON, determina:
1. is_sagra: true se l'evento e una sagra, festa del cibo, o fiera gastronomica. false se e antiquariato, mostra, mercato generico, concerto, evento sportivo, o altro evento non gastronomico.
2. food_tags: array con i tag alimentari pertinenti (max 3) scelti SOLO da: ${FOOD_TAGS.join(", ")}
3. feature_tags: array con i tag caratteristici (max 2) scelti SOLO da: ${FEATURE_TAGS.join(", ")}
4. enhanced_description: descrizione coinvolgente in italiano, max ${MAX_DESC_CHARS} caratteri, che menzioni il cibo principale e l'atmosfera

EVENTI:
${JSON.stringify(batch)}

Rispondi con un array JSON, un oggetto per ogni evento con: id, is_sagra, food_tags, feature_tags, enhanced_description.`;
}
```

**Schema change:**
```typescript
responseSchema: {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      is_sagra: { type: "BOOLEAN" },  // NEW
      food_tags: { type: "ARRAY", items: { type: "STRING" } },
      feature_tags: { type: "ARRAY", items: { type: "STRING" } },
      enhanced_description: { type: "STRING" },
    },
    required: ["id", "is_sagra", "food_tags", "feature_tags", "enhanced_description"],
  },
},
```

**Post-processing in runLLMPass:**
```typescript
// After enriching each sagra, check is_sagra
if (result.is_sagra === false) {
  await supabase.from("sagre").update({
    is_active: false,
    status: "classified_non_sagra",
    updated_at: new Date().toISOString(),
  }).eq("id", result.id);
} else {
  await supabase.from("sagre").update({
    food_tags,
    feature_tags,
    enhanced_description,
    status: "enriched",
    updated_at: new Date().toISOString(),
  }).eq("id", result.id);
}
```

**Key design decision: Deactivate, never delete.** Non-sagre are set to `is_active = false`, not deleted. This allows manual review and easy reactivation if the classifier makes a mistake.

### Pattern 3: Image URL Upgrade (Source-Specific Patterns)

**What:** A pure function `tryUpgradeImageUrl(imageUrl, sourceName)` that attempts to replace thumbnail URLs with full-resolution equivalents using known URL patterns per source site.

**When to use:** In the scrape pipeline, after extracting the raw image URL and before inserting into DB.

**Example:**
```typescript
// Source: WordPress thumbnail convention + manual source site analysis
function tryUpgradeImageUrl(imageUrl: string | null, sourceName: string): string | null {
  if (!imageUrl) return null;

  switch (sourceName) {
    case "sagritaly":
      // WordPress thumbnail suffix: image-150x150.jpg -> image.jpg
      // Pattern: -\d+x\d+ before file extension
      return imageUrl.replace(/-\d+x\d+(\.\w+)$/, "$1");

    case "solosagre":
      // Query param thumbnails: ?w=150&h=150
      try {
        const url = new URL(imageUrl);
        url.searchParams.delete("w");
        url.searchParams.delete("h");
        url.searchParams.delete("resize");
        return url.toString();
      } catch {
        return imageUrl;
      }

    case "venetoinfesta":
      // Small list images: check for data-src or srcset with larger version
      // This is handled at extraction time, not in URL manipulation
      return imageUrl;

    default:
      return imageUrl;
  }
}
```

**WordPress URL pattern detail:** WordPress generates thumbnails with a `-{width}x{height}` suffix before the file extension. For example:
- Thumbnail: `https://sagritaly.com/wp-content/uploads/2026/03/sagra-pesce-150x150.jpg`
- Full resolution: `https://sagritaly.com/wp-content/uploads/2026/03/sagra-pesce.jpg`

The regex `-\d+x\d+(\.\w+)$` reliably catches all WordPress thumbnail suffixes.

### Pattern 4: Branded Image Placeholder

**What:** Replace the current generic gradient placeholder (`bg-gradient-to-br from-amber-100 to-green-100` + grey UtensilsCrossed icon) with a branded, visually pleasant placeholder that signals "no image available" without looking broken.

**When to use:** In SagraCard.tsx and SagraDetail.tsx when `image_url` is null or the image fails to load.

**Design approach:**
```tsx
// Placeholder with brand identity (will be updated when Phase 16 changes palette)
<div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10">
  <div className="flex flex-col items-center gap-1.5 text-muted-foreground/40">
    <UtensilsCrossed className="h-8 w-8" />
    <span className="text-xs font-medium tracking-wide uppercase">Sagra</span>
  </div>
</div>
```

**Notes:**
- Uses CSS custom properties (var-based) so it automatically updates when Phase 16 changes the palette
- The placeholder should be consistent across SagraCard and SagraDetail (extract to a shared component if not already)
- No image loading/error detection needed for this requirement -- it only covers `image_url === null`

### Anti-Patterns to Avoid

- **Anti-pattern: LLM classification at scrape time.** Scrape-sagre processes hundreds of events. Adding Gemini calls would hit rate limits and exceed Edge Function timeouts. Classification MUST stay in enrich-sagre.

- **Anti-pattern: Deleting non-sagra events.** `DELETE FROM sagre WHERE is_sagra = false` removes audit trail. Always use `is_active = false`.

- **Anti-pattern: Client-side fuzzy matching.** Fetching 700+ rows to JavaScript for string similarity comparison is wasteful. pg_trgm runs where the data lives, with GIN indexing.

- **Anti-pattern: Fetching detail pages for images.** Scraping each event's detail page to find og:image is HIGH effort (adds 5-10 min per run with politeness delays), explicitly listed as "Out of Scope" in REQUIREMENTS.md. Stick to URL pattern manipulation.

- **Anti-pattern: Using pg_trgm's `%` operator without explicit threshold.** The `%` operator uses a session-level threshold (default 0.3, too loose for dedup). Always use `similarity() > threshold` with explicit numeric values for deterministic behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy text matching | Levenshtein distance in JS | pg_trgm `similarity()` in PostgreSQL | Runs server-side with GIN index; 700+ rows comparison is wasteful in JS |
| Event type classification | Regex-based "is this a sagra?" | Gemini 2.5 Flash `is_sagra: BOOLEAN` | Italian event names are too diverse for regex; "Mostra Mercato Antiquariato" vs "Festa del Baccala" requires language understanding |
| Image resizing/optimization | Sharp or custom image proxy | Next.js Image Optimization (already configured) | Already does resize, compress, WebP/AVIF; `hostname: "**"` configured |
| WordPress thumbnail removal | Manual string operations | Regex `-\d+x\d+(\.\w+)$` | Standard WordPress convention, well-documented, single regex handles all cases |

## Common Pitfalls

### Pitfall 1: pg_trgm Schema Qualification on Supabase

**What goes wrong:** `CREATE EXTENSION IF NOT EXISTS pg_trgm;` creates the extension, but `similarity()` calls in RPC functions fail with "function similarity(text, text) does not exist".

**Why it happens:** Supabase may create extensions in a schema not on the RPC function's search_path. The existing project creates extensions in `extensions` schema (PostGIS, unaccent, pg_net), but RPC functions are in `public` schema.

**How to avoid:** Either:
1. Create pg_trgm in `extensions` schema and use `extensions.similarity()` in the RPC
2. Create pg_trgm in `public` schema (simpler but inconsistent with project convention)

**Recommendation:** Option 1 (consistency). Use `extensions.similarity()` and `extensions.gin_trgm_ops` in all SQL.

**Warning signs:** "function similarity does not exist" error when running the upgraded RPC.

### Pitfall 2: Similarity Threshold Too Loose or Too Strict

**What goes wrong:** At threshold 0.3 (pg_trgm default), unrelated sagre get merged. At threshold 0.9, actual duplicates slip through.

**Why it happens:** Italian sagra names share common prefixes ("Sagra del...", "Festa della...") which inflate similarity scores between unrelated events.

**How to avoid:** Use `normalized_title` (not raw `title`) for similarity comparison. The normalization strips accents, punctuation, and extra spaces, making trigram matching more reliable. Start with 0.6 for titles and 0.5 for cities, then validate with production data.

**Warning signs:** Reviewing merged events and finding unrelated sagre grouped together, or checking active events and finding obvious duplicates still present.

### Pitfall 3: Gemini is_sagra False Positives

**What goes wrong:** The LLM incorrectly classifies a legitimate sagra as non-sagra (e.g., "Festa dell'Artigianato e del Gusto" classified as non-sagra because "artigianato" triggered the classifier).

**Why it happens:** Some sagre have mixed themes -- food + crafts, food + music. The LLM may focus on the non-food keyword.

**How to avoid:**
1. Use `is_active = false` (never delete) so false positives are recoverable
2. Prompt engineering: instruct the LLM that sagre with food components should be classified as sagra even if they have non-food elements
3. Log classifications for manual review via Supabase dashboard

**Warning signs:** Legitimate sagre disappearing from the app after enrichment runs.

### Pitfall 4: Image URL Upgrade Breaking Valid Images

**What goes wrong:** The regex removes a legitimate part of the URL, producing a 404. For example, an image URL that contains dimensions in a non-WordPress pattern gets its URL mangled.

**Why it happens:** Not all `-NNNxNNN` patterns in URLs are WordPress thumbnails. Some CDNs use dimensions in the path for routing.

**How to avoid:** Only apply source-specific upgrade patterns (check `sourceName` first). Never apply WordPress regex to non-WordPress sources. The `tryUpgradeImageUrl()` function must be keyed by source name.

**Warning signs:** Images that were showing before now show as broken/missing after the upgrade.

### Pitfall 5: Retroactive Dedup Merging Wrong Records

**What goes wrong:** Running a SQL dedup query against existing data without careful review results in legitimate distinct events being marked as duplicates.

**Why it happens:** Two sagre in the same city with similar names (e.g., "Sagra del Pesce" and "Sagra del Pesce Fritto") might be separate events at different venues or dates.

**How to avoid:** The retroactive dedup query should require BOTH title similarity AND date overlap (or both missing dates). Never dedup on title similarity alone. Run a dry-run SELECT first to review candidates before any UPDATE.

**Warning signs:** Active event count drops significantly after retroactive cleanup.

## Code Examples

### Example 1: Complete Migration SQL (007_dedup_classification.sql)

```sql
-- Source: PostgreSQL pg_trgm docs + project migration convention

-- Section 1: Enable pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Section 2: GIN index for fast fuzzy title lookups
CREATE INDEX IF NOT EXISTS idx_sagre_title_trgm
  ON public.sagre USING gin (normalized_title extensions.gin_trgm_ops);

-- Section 3: Upgraded find_duplicate_sagra with fuzzy matching
CREATE OR REPLACE FUNCTION public.find_duplicate_sagra(
  p_normalized_title TEXT,
  p_city TEXT,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  image_url TEXT,
  price_info TEXT,
  is_free BOOLEAN,
  sources TEXT[]
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.image_url, s.price_info, s.is_free, s.sources
  FROM public.sagre s
  WHERE s.is_active = true
    AND (
      s.normalized_title = p_normalized_title
      OR extensions.similarity(s.normalized_title, p_normalized_title) > 0.6
    )
    AND (
      lower(s.location_text) = p_city
      OR extensions.similarity(lower(s.location_text), p_city) > 0.5
    )
    AND (
      (p_start_date IS NOT NULL AND s.start_date IS NOT NULL
       AND daterange(s.start_date, COALESCE(s.end_date, s.start_date), '[]')
           && daterange(p_start_date, COALESCE(p_end_date, p_start_date), '[]'))
      OR (p_start_date IS NULL OR s.start_date IS NULL)
    )
  ORDER BY extensions.similarity(s.normalized_title, p_normalized_title) DESC
  LIMIT 1;
END;
$$;

-- Section 4: Retroactive dedup (dry-run first, then UPDATE)
-- DRY-RUN: SELECT to review duplicate candidates
-- SELECT a.id, a.title, a.location_text, b.id as dup_id, b.title as dup_title,
--        extensions.similarity(a.normalized_title, b.normalized_title) as sim
-- FROM sagre a
-- JOIN sagre b ON a.id < b.id
-- WHERE a.is_active = true AND b.is_active = true
--   AND extensions.similarity(a.normalized_title, b.normalized_title) > 0.6
--   AND (lower(a.location_text) = lower(b.location_text)
--        OR extensions.similarity(lower(a.location_text), lower(b.location_text)) > 0.5)
-- ORDER BY sim DESC;
```

### Example 2: Enrichment Response Type Update

```typescript
// Source: Existing enrich-sagre pattern
interface EnrichmentResult {
  id: string;
  is_sagra: boolean;  // NEW
  food_tags: string[];
  feature_tags: string[];
  enhanced_description: string;
}
```

### Example 3: Image URL Upgrade Test Cases

```typescript
// Source: WordPress thumbnail convention
describe("tryUpgradeImageUrl", () => {
  it("removes WordPress -WxH suffix from sagritaly", () => {
    expect(tryUpgradeImageUrl(
      "https://sagritaly.com/uploads/sagra-150x150.jpg",
      "sagritaly"
    )).toBe("https://sagritaly.com/uploads/sagra.jpg");
  });

  it("handles WordPress -WxH with larger dimensions", () => {
    expect(tryUpgradeImageUrl(
      "https://sagritaly.com/uploads/img-300x200.jpeg",
      "sagritaly"
    )).toBe("https://sagritaly.com/uploads/img.jpeg");
  });

  it("does not modify URLs without WordPress suffix", () => {
    expect(tryUpgradeImageUrl(
      "https://sagritaly.com/uploads/full-image.jpg",
      "sagritaly"
    )).toBe("https://sagritaly.com/uploads/full-image.jpg");
  });

  it("returns null for null input", () => {
    expect(tryUpgradeImageUrl(null, "sagritaly")).toBeNull();
  });

  it("removes query params for solosagre", () => {
    expect(tryUpgradeImageUrl(
      "https://solosagre.it/img/event.jpg?w=150&h=150",
      "solosagre"
    )).toBe("https://solosagre.it/img/event.jpg");
  });

  it("passes through unknown sources unchanged", () => {
    expect(tryUpgradeImageUrl(
      "https://example.com/img.jpg",
      "assosagre"
    )).toBe("https://example.com/img.jpg");
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Exact title dedup only | pg_trgm fuzzy matching | pg_trgm in PostgreSQL since v8.3, GIN ops stable | Catches "Sagra del Pesce" vs "Sagra del Pesce Fresco" duplicates |
| No event type classification | Gemini boolean classification | Gemini 2.5 Flash structured output (2025) | Zero additional API calls, rides existing enrichment batch |
| Thumbnail images from listing pages | URL pattern manipulation | Standard WordPress convention | Better image quality with zero additional HTTP requests |

**Deprecated/outdated:**
- pg_trgm `set_limit()` / `show_limit()` functions are deprecated -- use `pg_trgm.similarity_threshold` GUC parameter or explicit `similarity() > threshold` comparisons instead
- Old Gemini API (before @google/genai@1) used different structured output configuration -- project already uses current SDK

## Open Questions

1. **pg_trgm in `extensions` schema -- GIN index operator class**
   - What we know: Creating pg_trgm in `extensions` schema means functions are at `extensions.similarity()`. The GIN operator class would be `extensions.gin_trgm_ops`.
   - What's unclear: Whether GIN indexes can reference cross-schema operator classes. If not, pg_trgm may need to be in `public` schema.
   - Recommendation: Test in Supabase SQL Editor before committing. If cross-schema GIN ops fail, create in `public` schema with a comment explaining the deviation from convention.

2. **Optimal similarity thresholds**
   - What we know: 0.6 for titles and 0.5 for cities are reasonable starting points based on pg_trgm documentation and prior research.
   - What's unclear: Whether these thresholds are too loose or too strict for actual Veneto sagra naming patterns. Italian sagre share "Sagra del/della/dei..." prefixes.
   - Recommendation: Run the dry-run SELECT query against production data, review results, and adjust thresholds before committing the UPDATE. Document chosen thresholds with rationale.

3. **Retroactive classification of existing enriched events**
   - What we know: Events already in "enriched" status won't be re-processed by the enrichment pipeline (it only picks up pending_llm/geocode_failed).
   - What's unclear: How to classify existing enriched events without re-enriching them all.
   - Recommendation: Add a one-time retroactive classification step: query all enriched active events, batch them through Gemini with is_sagra-only prompt, deactivate non-sagre. This is a separate migration script or one-time Edge Function invocation.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DQ-06 | Fuzzy dedup matches near-identical titles | unit | `npx vitest run src/lib/scraper/__tests__/filters.test.ts -t "tryUpgradeImageUrl"` | No -- Wave 0 (add to filters.test.ts or new dedup.test.ts) |
| DQ-06 | pg_trgm RPC returns fuzzy matches | manual-only | SQL Editor dry-run query against production | N/A (SQL verification) |
| DQ-07 | Enrichment prompt includes is_sagra | unit | `npx vitest run src/lib/enrichment/__tests__/llm.test.ts -t "is_sagra"` | No -- Wave 0 |
| DQ-08 | No additional API calls (schema field only) | unit | `npx vitest run src/lib/enrichment/__tests__/llm.test.ts -t "buildEnrichmentPrompt"` | Yes (update existing) |
| DQ-09 | WordPress -WxH suffix removed | unit | `npx vitest run src/lib/scraper/__tests__/filters.test.ts -t "tryUpgradeImageUrl"` | No -- Wave 0 |
| DQ-10 | Placeholder renders without image | manual-only | Visual inspection in dev server | N/A (UI component) |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/scraper/__tests__/image-upgrade.test.ts` -- or add to filters.test.ts: covers DQ-09 (tryUpgradeImageUrl patterns)
- [ ] Update `src/lib/enrichment/__tests__/llm.test.ts` -- covers DQ-07, DQ-08 (is_sagra in prompt + schema)
- [ ] SQL dry-run verification queries for DQ-06 (manual, not automated)

## Sources

### Primary (HIGH confidence)
- [PostgreSQL pg_trgm documentation](https://www.postgresql.org/docs/current/pgtrgm.html) -- similarity() function, GIN index, operator classes, default thresholds
- [Gemini Structured Output docs](https://ai.google.dev/gemini-api/docs/structured-output) -- BOOLEAN type support in responseSchema, JSON schema features
- Existing project codebase -- enrich-sagre/index.ts (current Gemini schema), scrape-sagre/index.ts (current pipeline), find_duplicate_sagra RPC (current exact matching)

### Secondary (MEDIUM confidence)
- [Supabase pg_trgm issue #30503](https://github.com/supabase/supabase/issues/30503) -- Schema qualification issue with similarity() function; resolved by using schema-qualified function names
- [Supabase Extensions docs](https://supabase.com/docs/guides/database/extensions) -- pg_trgm is listed as available extension on all tiers
- WordPress thumbnail URL convention (well-documented: `-{width}x{height}` suffix before file extension)

### Tertiary (LOW confidence)
- Optimal similarity threshold values (0.6/0.5) -- reasonable starting points from documentation defaults but need validation against actual production data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- pg_trgm is built-in PostgreSQL, Gemini structured output boolean is confirmed, zero new npm packages
- Architecture: HIGH -- all changes extend existing patterns (RPC upgrade, prompt modification, URL manipulation)
- Pitfalls: HIGH -- schema qualification issue is well-documented, threshold tuning risk is mitigated by dry-run approach
- Image upgrade: MEDIUM -- WordPress pattern is reliable but other sources may need manual URL analysis

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain -- PostgreSQL extensions and Gemini API are mature)
