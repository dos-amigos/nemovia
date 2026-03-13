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

  it("maps Broccolo to verdura", () => {
    expect(getPrimaryCategory(["Broccolo"])).toBe("verdura");
  });

  it("maps Asparago to verdura", () => {
    expect(getPrimaryCategory(["Asparago"])).toBe("verdura");
  });

  it("maps Bisi to verdura", () => {
    expect(getPrimaryCategory(["Bisi"])).toBe("verdura");
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

  it("maps Baccalà to pesce", () => {
    expect(getPrimaryCategory(["Baccalà"])).toBe("pesce");
  });

  it("maps Salsiccia to carne", () => {
    expect(getPrimaryCategory(["Salsiccia"])).toBe("carne");
  });

  it("maps Tiramisù to dolci", () => {
    expect(getPrimaryCategory(["Tiramisù"])).toBe("dolci");
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

  it("ignores Giostre feature tag (not a food icon)", () => {
    expect(getPrimaryCategory(["Prodotti Tipici"], ["Giostre"])).toBe("altro");
  });

  it("returns altro when no food tags even with Giostre feature", () => {
    expect(getPrimaryCategory(null, ["Giostre"])).toBe("altro");
  });

  it("returns specific food regardless of Giostre feature", () => {
    expect(getPrimaryCategory(["Carne"], ["Giostre"])).toBe("carne");
  });
});
