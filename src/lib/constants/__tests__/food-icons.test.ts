import { describe, it, expect } from "vitest";
import { getPrimaryCategory } from "../food-icons";

describe("getPrimaryCategory", () => {
  it("maps Carne to carne", () => {
    expect(getPrimaryCategory(["Carne"])).toBe("carne");
  });

  it("maps Pesce to pesce", () => {
    expect(getPrimaryCategory(["Pesce"])).toBe("pesce");
  });

  it("maps Funghi to verdura (earthy/leafy category)", () => {
    expect(getPrimaryCategory(["Funghi"])).toBe("verdura");
  });

  it("maps Radicchio to verdura", () => {
    expect(getPrimaryCategory(["Radicchio"])).toBe("verdura");
  });

  it("maps Vino to altro (no specific icon)", () => {
    expect(getPrimaryCategory(["Vino"])).toBe("altro");
  });

  it("maps Dolci to altro", () => {
    expect(getPrimaryCategory(["Dolci"])).toBe("altro");
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
    // carne has higher priority than pesce in the priority order
    expect(getPrimaryCategory(["Pesce", "Carne"])).toBe("carne");
  });

  it("returns altro for undefined input", () => {
    expect(getPrimaryCategory(undefined as unknown as null)).toBe("altro");
  });
});
