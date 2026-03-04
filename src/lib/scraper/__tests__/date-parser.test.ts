import { describe, it, expect } from "vitest";
import { parseItalianDateRange } from "../date-parser";

describe("parseItalianDateRange", () => {
  it("parses DD/MM/YYYY al DD/MM/YYYY range", () => {
    expect(parseItalianDateRange("24/04/2026 al 26/04/2026")).toEqual({
      start: "2026-04-24",
      end: "2026-04-26",
    });
  });

  it("parses Dal DD/MM/YYYY Al DD/MM/YYYY", () => {
    expect(parseItalianDateRange("Dal 08/03/2026 Al 08/03/2026")).toEqual({
      start: "2026-03-08",
      end: "2026-03-08",
    });
  });

  it("parses single DD/MM/YYYY", () => {
    const result = parseItalianDateRange("Il 08/03/2026");
    expect(result.start).toBe("2026-03-08");
    expect(result.end).toBe("2026-03-08");
  });

  it("parses DD MonthName YYYY", () => {
    expect(parseItalianDateRange("24 Aprile 2026")).toEqual({
      start: "2026-04-24",
      end: "2026-04-24",
    });
  });

  it("parses DD-DD MonthName YYYY (multi-day)", () => {
    const result = parseItalianDateRange("24-26 Aprile 2026");
    expect(result.start).toBe("2026-04-24");
    expect(result.end).toBe("2026-04-26");
  });

  it("handles lowercase month names", () => {
    expect(parseItalianDateRange("24 aprile 2026")).toEqual({
      start: "2026-04-24",
      end: "2026-04-24",
    });
  });

  it("returns nulls for empty string", () => {
    expect(parseItalianDateRange("")).toEqual({ start: null, end: null });
  });

  it("returns nulls for unparseable text", () => {
    expect(parseItalianDateRange("prossimamente")).toEqual({ start: null, end: null });
  });

  it("output is ISO format YYYY-MM-DD", () => {
    const result = parseItalianDateRange("05/01/2026");
    expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
