import { describe, it, expect } from "vitest";
import {
  FOOD_TAGS,
  FEATURE_TAGS,
  BATCH_SIZE,
  validateTags,
  truncateDescription,
  chunkBatch,
  buildEnrichmentPrompt,
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
});

describe("constants", () => {
  it("BATCH_SIZE is between 5 and 10", () => {
    expect(BATCH_SIZE).toBeGreaterThanOrEqual(5);
    expect(BATCH_SIZE).toBeLessThanOrEqual(10);
  });
  it("FOOD_TAGS has 8 entries", () => {
    expect(FOOD_TAGS).toHaveLength(8);
  });
  it("FEATURE_TAGS has 5 entries", () => {
    expect(FEATURE_TAGS).toHaveLength(5);
  });
});
