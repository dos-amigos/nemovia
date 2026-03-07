import { describe, it, expect } from "vitest";
import { cleanCityName, normalizeLocationText, isValidItalyCoord, isVenetoProvince, VENETO_PROVINCES } from "../geocode";

describe("normalizeLocationText", () => {
  it("removes parenthetical province codes and adds Veneto suffix", () => {
    expect(normalizeLocationText("Verona (VR)")).toBe("Verona, Veneto");
  });
  it("removes dash province suffix and adds Veneto suffix", () => {
    expect(normalizeLocationText("Treviso - TV")).toBe("Treviso, Veneto");
  });
  it("removes comma province suffix", () => {
    expect(normalizeLocationText("Padova, PD")).toBe("Padova, Veneto");
  });
  it("trims surrounding whitespace", () => {
    expect(normalizeLocationText("  Padova  ")).toBe("Padova, Veneto");
  });
  it("handles Venezia (VE)", () => {
    expect(normalizeLocationText("Venezia (VE)")).toBe("Venezia, Veneto");
  });
  it("adds Veneto disambiguation for bare city names", () => {
    expect(normalizeLocationText("Mestre")).toBe("Mestre, Veneto");
  });
  it("strips region prefix", () => {
    expect(normalizeLocationText("Veneto - Cittadella")).toBe("Cittadella, Veneto");
  });
  it("strips Provincia di prefix", () => {
    expect(normalizeLocationText("Provincia di Rovigo")).toBe("Rovigo, Veneto");
  });
  it("returns empty for empty input", () => {
    expect(normalizeLocationText("")).toBe("");
  });
  it("preserves existing commas without adding Veneto", () => {
    expect(normalizeLocationText("Mestre, Venezia")).toBe("Mestre, Venezia");
  });
});

describe("cleanCityName (deprecated alias)", () => {
  it("is an alias for normalizeLocationText", () => {
    expect(cleanCityName("Verona (VR)")).toBe(normalizeLocationText("Verona (VR)"));
  });
});

describe("isVenetoProvince", () => {
  it("returns true for lowercase province name", () => {
    expect(isVenetoProvince("padova")).toBe(true);
  });
  it("returns true for mixed-case province name", () => {
    expect(isVenetoProvince("Venezia")).toBe(true);
  });
  it("returns true for full form", () => {
    expect(isVenetoProvince("Provincia di Verona")).toBe(true);
  });
  it("returns false for non-Veneto province", () => {
    expect(isVenetoProvince("Milano")).toBe(false);
  });
  it("returns false for null", () => {
    expect(isVenetoProvince(null)).toBe(false);
  });
  it("returns false for empty string", () => {
    expect(isVenetoProvince("")).toBe(false);
  });
});

describe("VENETO_PROVINCES", () => {
  it("contains all 7 provinces in lowercase", () => {
    const baseProvinces = ["belluno", "padova", "rovigo", "treviso", "venezia", "verona", "vicenza"];
    for (const p of baseProvinces) {
      expect(VENETO_PROVINCES).toContain(p);
    }
  });
});

describe("isValidItalyCoord", () => {
  it("returns true for Venezia coordinates", () => {
    expect(isValidItalyCoord(45.4, 12.3)).toBe(true);
  });
  it("returns true at southern boundary (inclusive)", () => {
    expect(isValidItalyCoord(36.0, 6.0)).toBe(true);
  });
  it("returns false too far south", () => {
    expect(isValidItalyCoord(35.9, 12.0)).toBe(false);
  });
  it("returns false for London", () => {
    expect(isValidItalyCoord(51.5, -0.1)).toBe(false);
  });
  it("returns false too far east", () => {
    expect(isValidItalyCoord(45.0, 20.0)).toBe(false);
  });
});
