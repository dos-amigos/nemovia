import { describe, it, expect } from "vitest";
import { cleanCityName, isValidItalyCoord } from "../geocode";

describe("cleanCityName", () => {
  it("removes parenthetical province codes", () => {
    expect(cleanCityName("Verona (VR)")).toBe("Verona");
  });
  it("removes dash province suffix", () => {
    expect(cleanCityName("Treviso - TV")).toBe("Treviso");
  });
  it("trims surrounding whitespace", () => {
    expect(cleanCityName("  Padova  ")).toBe("Padova");
  });
  it("handles Venezia (VE)", () => {
    expect(cleanCityName("Venezia (VE)")).toBe("Venezia");
  });
  it("leaves plain city names unchanged", () => {
    expect(cleanCityName("Mestre")).toBe("Mestre");
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
