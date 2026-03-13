import { describe, it, expect } from "vitest";
import { getPrimaryCategory } from "../food-icons";

describe("getPrimaryCategory", () => {
  // Tag-based tests
  it("maps Carne to carne", () => {
    expect(getPrimaryCategory(["Carne"])).toBe("carne");
  });
  it("maps Pesce to pesce", () => {
    expect(getPrimaryCategory(["Pesce"])).toBe("pesce");
  });
  it("maps Funghi to verdura", () => {
    expect(getPrimaryCategory(["Funghi"])).toBe("verdura");
  });
  it("maps Radicchio to verdura", () => {
    expect(getPrimaryCategory(["Radicchio"])).toBe("verdura");
  });
  it("maps Broccolo to verdura", () => {
    expect(getPrimaryCategory(["Broccolo"])).toBe("verdura");
  });
  it("maps Vino to vino", () => {
    expect(getPrimaryCategory(["Vino"])).toBe("vino");
  });
  it("maps Dolci to dolci", () => {
    expect(getPrimaryCategory(["Dolci"])).toBe("dolci");
  });
  it("maps Formaggi to altro", () => {
    expect(getPrimaryCategory(["Formaggi"])).toBe("altro");
  });
  it("maps Prodotti Tipici to altro", () => {
    expect(getPrimaryCategory(["Prodotti Tipici"])).toBe("altro");
  });
  it("maps Zucca to zucca", () => {
    expect(getPrimaryCategory(["Zucca"])).toBe("zucca");
  });
  it("maps Gnocchi to gnocco", () => {
    expect(getPrimaryCategory(["Gnocchi"])).toBe("gnocco");
  });
  it("maps Baccalà to pesce", () => {
    expect(getPrimaryCategory(["Baccalà"])).toBe("pesce");
  });
  it("maps Salsiccia to carne", () => {
    expect(getPrimaryCategory(["Salsiccia"])).toBe("carne");
  });
  it("maps Tiramisù to dolci", () => {
    expect(getPrimaryCategory(["Tiramisù"])).toBe("dolci");
  });

  // Null/empty
  it("returns altro for null input", () => {
    expect(getPrimaryCategory(null)).toBe("altro");
  });
  it("returns altro for empty array", () => {
    expect(getPrimaryCategory([])).toBe("altro");
  });
  it("returns altro for undefined input", () => {
    expect(getPrimaryCategory(undefined as unknown as null)).toBe("altro");
  });

  // Priority
  it("picks specific tag over generic", () => {
    expect(getPrimaryCategory(["Prodotti Tipici", "Carne"])).toBe("carne");
  });
  it("picks highest-priority category", () => {
    expect(getPrimaryCategory(["Pesce", "Carne"])).toBe("carne");
  });

  // Giostre ignored
  it("ignores Giostre feature tag", () => {
    expect(getPrimaryCategory(["Prodotti Tipici"], ["Giostre"])).toBe("altro");
  });

  // TITLE-BASED FALLBACK — the key tests
  it("detects verdura from title 'Sagra del Broccolo'", () => {
    expect(getPrimaryCategory(["Prodotti Tipici"], null, "Sagra del Broccolo")).toBe("verdura");
  });
  it("detects verdura from title 'Festa del Radicchio Rosso'", () => {
    expect(getPrimaryCategory(null, null, "Festa del Radicchio Rosso")).toBe("verdura");
  });
  it("detects verdura from title 'Sagra degli Asparagi'", () => {
    expect(getPrimaryCategory(null, null, "Sagra degli Asparagi")).toBe("verdura");
  });
  it("detects zucca from title 'Sagra della Zucca'", () => {
    expect(getPrimaryCategory(null, null, "Sagra della Zucca")).toBe("zucca");
  });
  it("detects carne from title 'Sagra della Salsiccia'", () => {
    expect(getPrimaryCategory(null, null, "Sagra della Salsiccia")).toBe("carne");
  });
  it("detects pesce from title 'Festa del Baccalà'", () => {
    expect(getPrimaryCategory(null, null, "Festa del Baccalà")).toBe("pesce");
  });
  it("detects vino from title 'Calici in Piazza'", () => {
    expect(getPrimaryCategory(null, null, "Calici in Piazza")).toBe("vino");
  });
  it("detects gnocco from title 'Sagra degli Gnocchi'", () => {
    expect(getPrimaryCategory(null, null, "Sagra degli Gnocchi")).toBe("gnocco");
  });
  it("specific tag wins over title fallback", () => {
    expect(getPrimaryCategory(["Pesce"], null, "Sagra della Zucca")).toBe("pesce");
  });
  it("returns altro when title has no food keywords", () => {
    expect(getPrimaryCategory(null, null, "Festa dell'Addolorata")).toBe("altro");
  });
});
