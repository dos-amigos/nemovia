import { describe, it, expect } from "vitest";
import {
  getHeroImage,
  parseImageCredit,
  TAG_QUERIES,
  DEFAULT_QUERY,
  type UnsplashHeroImage,
} from "@/lib/unsplash";

describe("parseImageCredit", () => {
  it("parses valid credit string into name and url", () => {
    const result = parseImageCredit(
      "Eiliv Aceron|https://unsplash.com/@eilivaceron"
    );
    expect(result).toEqual({
      name: "Eiliv Aceron",
      url: "https://unsplash.com/@eilivaceron",
    });
  });

  it("returns null for null input", () => {
    expect(parseImageCredit(null)).toBeNull();
  });

  it("returns null for malformed string without pipe delimiter", () => {
    expect(parseImageCredit("malformed")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseImageCredit("")).toBeNull();
  });
});

describe("getHeroImage", () => {
  it("returns a valid UnsplashHeroImage object", () => {
    const hero = getHeroImage();
    expect(hero).toHaveProperty("url");
    expect(hero).toHaveProperty("photographer");
    expect(hero).toHaveProperty("photographerUrl");
    expect(hero).toHaveProperty("unsplashUrl");
    expect(typeof hero.url).toBe("string");
    expect(typeof hero.photographer).toBe("string");
    expect(typeof hero.photographerUrl).toBe("string");
    expect(typeof hero.unsplashUrl).toBe("string");
  });

  it("returns hero image URLs containing utm_source=nemovia", () => {
    const hero = getHeroImage();
    expect(hero.url).toContain("utm_source=nemovia");
  });

  it("returns hero image photographerUrl containing utm_source=nemovia", () => {
    const hero = getHeroImage();
    expect(hero.photographerUrl).toContain("utm_source=nemovia");
  });

  it("rotates daily based on day index", () => {
    // getHeroImage uses Math.floor(Date.now() / 86_400_000) % HERO_IMAGES.length
    // We verify it returns a consistent value for the same day
    const hero1 = getHeroImage();
    const hero2 = getHeroImage();
    expect(hero1).toEqual(hero2);
  });
});

describe("TAG_QUERIES", () => {
  it("maps known food tags to Italian food search queries", () => {
    expect(TAG_QUERIES).toBeDefined();
    expect(typeof TAG_QUERIES).toBe("object");
  });

  const expectedTags = [
    "Pesce",
    "Carne",
    "Vino",
    "Formaggi",
    "Funghi",
    "Radicchio",
    "Dolci",
    "Prodotti Tipici",
  ];

  for (const tag of expectedTags) {
    it(`has entry for ${tag}`, () => {
      expect(TAG_QUERIES).toHaveProperty(tag);
      expect(typeof TAG_QUERIES[tag]).toBe("string");
      expect(TAG_QUERIES[tag].length).toBeGreaterThan(0);
    });
  }
});

describe("DEFAULT_QUERY", () => {
  it("is 'italian sagra food festival'", () => {
    expect(DEFAULT_QUERY).toBe("italian sagra food festival");
  });
});
