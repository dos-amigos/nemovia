import { describe, it, expect } from "vitest";
import {
  FOOD_TAGS,
  FEATURE_TAGS,
  BATCH_SIZE,
  validateTags,
  truncateDescription,
  chunkBatch,
  buildEnrichmentPrompt,
  type EnrichmentResult,
} from "../llm";

describe("validateTags", () => {
  it("filters out values not in enum", () => {
    expect(validateTags(["Pesce", "Invalid", "Vino"], FOOD_TAGS)).toEqual(["Pesce", "Vino"]);
  });
  it("filters feature tags against correct enum", () => {
    expect(validateTags(["Gratis", "Bambini", "Xyz"], FEATURE_TAGS)).toEqual(["Gratis", "Bambini"]);
  });
  it("returns empty array for empty input", () => {
    expect(validateTags([], FOOD_TAGS)).toEqual([]);
  });
});

describe("truncateDescription", () => {
  it("truncates strings longer than 250 chars", () => {
    const result = truncateDescription("x".repeat(300));
    expect(result.length).toBe(250);
  });
  it("leaves short strings unchanged", () => {
    expect(truncateDescription("Short text")).toBe("Short text");
  });
  it("leaves strings at exactly 250 chars unchanged", () => {
    const exact = "x".repeat(250);
    expect(truncateDescription(exact)).toBe(exact);
  });
});

describe("chunkBatch", () => {
  it("splits array into chunks of BATCH_SIZE", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const chunks = chunkBatch(items, 8);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(8);
    expect(chunks[1]).toHaveLength(2);
  });
  it("returns single chunk when fewer items than batch size", () => {
    expect(chunkBatch([1, 2, 3], 8)).toEqual([[1, 2, 3]]);
  });
  it("returns empty array for empty input", () => {
    expect(chunkBatch([], 8)).toEqual([]);
  });
});

describe("buildEnrichmentPrompt", () => {
  it("includes food tags and feature tags in prompt", () => {
    const sagre = [{ id: "1", title: "Sagra del Pesce", location_text: "Chioggia", description: null }];
    const prompt = buildEnrichmentPrompt(sagre);
    expect(prompt).toContain("Pesce");
    expect(prompt).toContain("Gratis");
    expect(prompt).toContain("Chioggia");
  });

  it("includes is_sagra classification instruction", () => {
    const sagre = [{ id: "1", title: "Sagra del Pesce", location_text: "Chioggia", description: null }];
    const prompt = buildEnrichmentPrompt(sagre);
    expect(prompt).toContain("is_sagra");
  });

  it("uses 'Per ogni evento' instead of 'Per ogni sagra'", () => {
    const sagre = [{ id: "1", title: "Test", location_text: "Verona", description: null }];
    const prompt = buildEnrichmentPrompt(sagre);
    expect(prompt).toContain("Per ogni evento");
    expect(prompt).not.toContain("Per ogni sagra");
  });
});

describe("is_sagra classification", () => {
  it("prompt contains is_sagra instruction text", () => {
    const sagre = [{ id: "1", title: "Mercato dell'Antiquariato", location_text: "Padova", description: "Mercato mensile" }];
    const prompt = buildEnrichmentPrompt(sagre);
    expect(prompt).toContain("is_sagra");
  });

  it("prompt mentions non-sagra classification criteria", () => {
    const sagre = [{ id: "1", title: "Test", location_text: "Verona", description: null }];
    const prompt = buildEnrichmentPrompt(sagre);
    expect(prompt).toContain("antiquariato");
    expect(prompt).toContain("mostra");
    expect(prompt).toContain("mercato");
  });

  it("prompt still contains food_tags and feature_tags instructions (no regression)", () => {
    const sagre = [{ id: "1", title: "Test", location_text: "Verona", description: null }];
    const prompt = buildEnrichmentPrompt(sagre);
    expect(prompt).toContain("food_tags");
    expect(prompt).toContain("feature_tags");
    expect(prompt).toContain("enhanced_description");
  });

  it("EnrichmentResult interface includes is_sagra boolean field", () => {
    const result: EnrichmentResult = {
      id: "test-1",
      food_tags: ["Pesce"],
      feature_tags: ["Gratis"],
      enhanced_description: "Test description",
      is_sagra: true,
    };
    expect(result.is_sagra).toBe(true);

    const nonSagra: EnrichmentResult = {
      id: "test-2",
      food_tags: [],
      feature_tags: [],
      enhanced_description: "Not a sagra",
      is_sagra: false,
    };
    expect(nonSagra.is_sagra).toBe(false);
  });

  it("prompt includes is_sagra in response format instruction", () => {
    const sagre = [{ id: "1", title: "Test", location_text: "Verona", description: null }];
    const prompt = buildEnrichmentPrompt(sagre);
    // The response format instruction should mention is_sagra
    expect(prompt).toMatch(/is_sagra.*food_tags|food_tags.*is_sagra/);
  });
});

describe("constants", () => {
  it("BATCH_SIZE is between 5 and 10", () => {
    expect(BATCH_SIZE).toBeGreaterThanOrEqual(5);
    expect(BATCH_SIZE).toBeLessThanOrEqual(10);
  });
  it("FOOD_TAGS has 11 entries", () => {
    expect(FOOD_TAGS).toHaveLength(11);
  });
  it("FEATURE_TAGS has 6 entries", () => {
    expect(FEATURE_TAGS).toHaveLength(6);
  });
});
