import { describe, it, expect } from "vitest";
import { getPrimaryCategory } from "../food-icons";

describe("getPrimaryCategory", () => {
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

  it("maps Zucca to zucca (dedicated pumpkin icon)", () => {
    expect(getPrimaryCategory(["Zucca"])).toBe("zucca");
  });

  it("maps Gnocchi to gnocco", () => {
    expect(getPrimaryCategory(["Gnocchi"])).toBe("gnocco");
  });

  it("returns altro for null input", () => {
    expect(getPrimaryCategory(null)).toBe("altro");
  });

  it("returns altro for empty array", () => {
    expect(getPrimaryCategory([])).toBe("altro");
  });

  it("picks specific tag over generic (Prodotti Tipici + Carne -> carne)", () => {
    expect(getPrimaryCategory(["Prodotti Tipici", "Carne"])).toBe("carne");
  });

  it("picks highest-priority category when multiple specifics present", () => {
    expect(getPrimaryCategory(["Pesce", "Carne"])).toBe("carne");
  });

  it("returns altro for undefined input", () => {
    expect(getPrimaryCategory(undefined as unknown as null)).toBe("altro");
  });

  it("returns giostre when feature_tags has Giostre and food is generic", () => {
    expect(getPrimaryCategory(["Prodotti Tipici"], ["Giostre"])).toBe("giostre");
  });

  it("returns giostre when no food tags but has Giostre feature", () => {
    expect(getPrimaryCategory(null, ["Giostre"])).toBe("giostre");
  });

  it("returns specific food over giostre when food is not generic", () => {
    expect(getPrimaryCategory(["Carne"], ["Giostre"])).toBe("carne");
  });
});
