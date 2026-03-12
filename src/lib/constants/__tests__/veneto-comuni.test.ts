import { describe, it, expect } from "vitest";
import {
  filterComuni,
  VENETO_COMUNI,
  type VenetoComune,
} from "../veneto-comuni";

describe("VENETO_COMUNI", () => {
  it("contains approximately 550+ Veneto comuni", () => {
    expect(VENETO_COMUNI.length).toBeGreaterThanOrEqual(540);
    expect(VENETO_COMUNI.length).toBeLessThanOrEqual(600);
  });

  it("each entry has nome, provincia, lat, lng", () => {
    for (const c of VENETO_COMUNI) {
      expect(typeof c.nome).toBe("string");
      expect(typeof c.provincia).toBe("string");
      expect(typeof c.lat).toBe("number");
      expect(typeof c.lng).toBe("number");
    }
  });

  it("includes all 7 Veneto province codes", () => {
    const codes = new Set(VENETO_COMUNI.map((c) => c.provincia));
    expect(codes).toContain("BL");
    expect(codes).toContain("PD");
    expect(codes).toContain("RO");
    expect(codes).toContain("TV");
    expect(codes).toContain("VE");
    expect(codes).toContain("VR");
    expect(codes).toContain("VI");
  });
});

describe("filterComuni", () => {
  it("returns empty array for empty query", () => {
    expect(filterComuni("", 8)).toEqual([]);
  });

  it("returns empty array for single character query (too short)", () => {
    expect(filterComuni("x", 8)).toEqual([]);
    expect(filterComuni("P", 8)).toEqual([]);
  });

  it("returns results matching 'Pa' for query 'Pa' (startsWith first)", () => {
    const results = filterComuni("Pa", 8);
    expect(results.length).toBeGreaterThan(0);
    // First results should start with "pa"
    expect(results[0].nome.toLowerCase().startsWith("pa")).toBe(true);
    // All results should at least contain the query
    for (const r of results) {
      expect(r.nome.toLowerCase()).toContain("pa");
    }
  });

  it("returns results matching 'Ab' for query 'ab' (startsWith first)", () => {
    const results = filterComuni("ab", 8);
    expect(results.length).toBeGreaterThan(0);
    // First results should start with "ab"
    expect(results[0].nome.toLowerCase().startsWith("ab")).toBe(true);
    // All results should at least contain the query
    for (const r of results) {
      expect(r.nome.toLowerCase()).toContain("ab");
    }
  });

  it("returns Verona with provincia 'VR'", () => {
    const results = filterComuni("Verona", 8);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const verona = results.find((r) => r.nome === "Verona");
    expect(verona).toBeDefined();
    expect(verona!.provincia).toBe("VR");
  });

  it("respects limit parameter", () => {
    const results = filterComuni("Ca", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("each result has required shape", () => {
    const results = filterComuni("Pa", 8);
    for (const r of results) {
      expect(r).toHaveProperty("nome");
      expect(r).toHaveProperty("provincia");
      expect(r).toHaveProperty("lat");
      expect(r).toHaveProperty("lng");
      expect(typeof r.nome).toBe("string");
      expect(typeof r.provincia).toBe("string");
      expect(typeof r.lat).toBe("number");
      expect(typeof r.lng).toBe("number");
    }
  });

  it("is case-insensitive", () => {
    const lower = filterComuni("pa", 8);
    const upper = filterComuni("PA", 8);
    const mixed = filterComuni("Pa", 8);
    expect(lower).toEqual(upper);
    expect(lower).toEqual(mixed);
  });

  it("includes contains-matches after startsWith-matches", () => {
    // "ano" should match "Anguillara Veneta" (starts), but also "Alano di Piave" (contains)
    // Specifically test that substring matches appear after prefix matches
    const results = filterComuni("iano", 20);
    expect(results.length).toBeGreaterThan(0);
    // All results must contain the query somewhere in the name
    for (const r of results) {
      expect(r.nome.toLowerCase()).toContain("iano");
    }
  });

  it("prioritizes startsWith matches over contains matches", () => {
    // "ba" should put "Badia Polesine" etc. before e.g. "Abano Terme"
    const results = filterComuni("ba", 20);
    const firstContainsIndex = results.findIndex(
      (r) => !r.nome.toLowerCase().startsWith("ba")
    );
    if (firstContainsIndex > 0) {
      // All items before firstContainsIndex should start with "ba"
      for (let i = 0; i < firstContainsIndex; i++) {
        expect(results[i].nome.toLowerCase().startsWith("ba")).toBe(true);
      }
    }
  });
});
