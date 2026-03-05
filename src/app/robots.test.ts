import { describe, it, expect } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("returns rules with userAgent '*'", () => {
    const result = robots();
    expect(result.rules).toBeDefined();

    // rules can be a single object or an array
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.userAgent).toBe("*");
  });

  it("allows '/' path", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.allow).toBe("/");
  });

  it("includes sitemap URL ending with /sitemap.xml", () => {
    const result = robots();
    expect(result.sitemap).toBeDefined();
    expect(result.sitemap).toContain("/sitemap.xml");
  });
});
