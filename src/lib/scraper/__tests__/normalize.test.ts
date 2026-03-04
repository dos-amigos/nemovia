import { describe, it, expect } from "vitest";
import { normalizeText, generateSlug, generateContentHash } from "../normalize";

describe("normalizeText", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeText("Sagra dei Mùseti e del Brovàda")).toBe("sagra dei museti e del brovada");
  });
  it("removes punctuation", () => {
    // Accept either contraction forms — just verify punctuation gone and lowercase
    const result = normalizeText("Sagra dell'Agnello");
    expect(result).not.toContain("'");
    expect(result).toBe(result.toLowerCase());
  });
  it("handles empty string", () => {
    expect(normalizeText("")).toBe("");
  });
  it("handles uppercase", () => {
    expect(normalizeText("SAGRA DELLA POLENTA")).toBe("sagra della polenta");
  });
});

describe("generateSlug", () => {
  it("creates url-safe slug from title and city", () => {
    const slug = generateSlug("Sagra del Pesce", "Venezia");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug).toContain("venezia");
  });
  it("replaces spaces with hyphens", () => {
    expect(generateSlug("Sagra del Pesce", "Venezia")).toMatch(/sagra-del-pesce/);
  });
});

describe("generateContentHash", () => {
  it("returns a stable hex string", () => {
    const hash = generateContentHash("Sagra del Pesce", "venezia", "2026-04-24");
    expect(hash).toMatch(/^[a-f0-9]{12}$/);
  });
  it("is deterministic", () => {
    const a = generateContentHash("Sagra del Pesce", "venezia", "2026-04-24");
    const b = generateContentHash("Sagra del Pesce", "venezia", "2026-04-24");
    expect(a).toBe(b);
  });
  it("differs for different inputs", () => {
    const a = generateContentHash("Sagra del Pesce", "venezia", "2026-04-24");
    const b = generateContentHash("Sagra della Carne", "venezia", "2026-04-24");
    expect(a).not.toBe(b);
  });
});
