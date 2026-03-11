import { describe, it, expect } from "vitest";
import {
  isNoiseTitle,
  isNonSagraTitle,
  isCalendarDateRange,
  isExcessiveDuration,
  isPastYearEvent,
  tryUpgradeImageUrl,
} from "../filters";

describe("isNoiseTitle", () => {
  describe("rejects empty/null/short/long titles", () => {
    it("rejects empty string", () => {
      expect(isNoiseTitle("")).toBe(true);
    });

    it("rejects very short titles (<5 chars)", () => {
      expect(isNoiseTitle("Abc")).toBe(true);
      expect(isNoiseTitle("Hi")).toBe(true);
    });

    it("rejects very long titles (>150 chars)", () => {
      const longTitle = "Sagra " + "a".repeat(150);
      expect(isNoiseTitle(longTitle)).toBe(true);
    });
  });

  describe("rejects calendar spam titles", () => {
    it("rejects 'Calendario mensile eventi sagre Gennaio 2026'", () => {
      expect(
        isNoiseTitle("Calendario mensile eventi sagre Gennaio 2026")
      ).toBe(true);
    });

    it("rejects 'Calendario eventi e sagre in Veneto'", () => {
      expect(isNoiseTitle("Calendario eventi e sagre in Veneto")).toBe(true);
    });

    it("rejects 'Calendario delle feste di paese'", () => {
      expect(isNoiseTitle("Calendario delle feste di paese")).toBe(true);
    });

    it("rejects 'Calendario regioni italiane'", () => {
      expect(isNoiseTitle("Calendario regioni italiane")).toBe(true);
    });
  });

  describe("rejects navigation noise", () => {
    it("rejects 'Cookie Policy'", () => {
      expect(isNoiseTitle("Cookie Policy")).toBe(true);
    });

    it("rejects 'Privacy Policy del sito'", () => {
      expect(isNoiseTitle("Privacy Policy del sito")).toBe(true);
    });

    it("rejects 'Termini e Condizioni'", () => {
      expect(isNoiseTitle("Termini e Condizioni")).toBe(true);
    });

    it("rejects 'Cerca sagre nel Veneto'", () => {
      expect(isNoiseTitle("Cerca sagre nel Veneto")).toBe(true);
    });

    it("rejects 'Menu principale'", () => {
      expect(isNoiseTitle("Menu principale")).toBe(true);
    });

    it("rejects 'Navigazione sito'", () => {
      expect(isNoiseTitle("Navigazione sito")).toBe(true);
    });

    it("rejects 'Home page del sito'", () => {
      expect(isNoiseTitle("Home page del sito")).toBe(true);
    });
  });

  describe("rejects new spam patterns", () => {
    it("rejects 'Programma completo delle sagre'", () => {
      expect(isNoiseTitle("Programma completo delle sagre")).toBe(true);
    });

    it("rejects 'Programma mensile eventi'", () => {
      expect(isNoiseTitle("Programma mensile eventi")).toBe(true);
    });

    it("rejects 'Programma settimanale sagre'", () => {
      expect(isNoiseTitle("Programma settimanale sagre")).toBe(true);
    });

    it("rejects 'Scopri tutte le sagre'", () => {
      expect(isNoiseTitle("Scopri tutte le sagre")).toBe(true);
    });

    it("rejects 'Vedi tutti gli eventi'", () => {
      expect(isNoiseTitle("Vedi tutti gli eventi")).toBe(true);
    });

    it("rejects 'Newsletter sagre del mese'", () => {
      expect(isNoiseTitle("Newsletter sagre del mese")).toBe(true);
    });

    it("rejects 'Iscriviti alla mailing list'", () => {
      expect(isNoiseTitle("Iscriviti alla mailing list")).toBe(true);
    });

    it("rejects 'Registrati per ricevere aggiornamenti'", () => {
      expect(isNoiseTitle("Registrati per ricevere aggiornamenti")).toBe(true);
    });
  });

  describe("rejects aggregator noise", () => {
    it("rejects 'Tutte le sagre del Veneto'", () => {
      expect(isNoiseTitle("Tutte le sagre del Veneto")).toBe(true);
    });

    it("rejects 'Elenco sagre marzo 2026'", () => {
      expect(isNoiseTitle("Elenco sagre marzo 2026")).toBe(true);
    });

    it("rejects 'Lista sagre in programma'", () => {
      expect(isNoiseTitle("Lista sagre in programma")).toBe(true);
    });
  });

  describe("rejects numeric-only titles", () => {
    it("rejects '01/02/2026'", () => {
      expect(isNoiseTitle("01/02/2026")).toBe(true);
    });

    it("rejects '2026-03-09'", () => {
      expect(isNoiseTitle("2026-03-09")).toBe(true);
    });

    it("rejects '15 03 2026'", () => {
      expect(isNoiseTitle("15 03 2026")).toBe(true);
    });
  });

  describe("rejects month-range titles", () => {
    it("rejects 'Gennaio a Dicembre 2026'", () => {
      expect(isNoiseTitle("Sagre da Gennaio a Dicembre 2026")).toBe(true);
    });
  });

  describe("accepts legitimate sagra titles", () => {
    it("accepts 'Sagra del Baccala alla Vicentina'", () => {
      expect(isNoiseTitle("Sagra del Baccala alla Vicentina")).toBe(false);
    });

    it("accepts 'Festa della Polenta'", () => {
      expect(isNoiseTitle("Festa della Polenta")).toBe(false);
    });

    it("accepts 'Sagra del Pesce di Chioggia'", () => {
      expect(isNoiseTitle("Sagra del Pesce di Chioggia")).toBe(false);
    });

    it("accepts 'Festa del Radicchio Rosso di Treviso'", () => {
      expect(isNoiseTitle("Festa del Radicchio Rosso di Treviso")).toBe(false);
    });

    it("accepts 'Sagra della Polenta - Calendario 2026' (real sagra with calendario in non-spam context)", () => {
      expect(isNoiseTitle("Sagra della Polenta - Calendario 2026")).toBe(
        false
      );
    });
  });
});

describe("isNonSagraTitle", () => {
  describe("rejects standalone non-sagra events", () => {
    it("rejects 'Passeggiata ecologica'", () => {
      expect(isNonSagraTitle("Passeggiata ecologica")).toBe(true);
    });

    it("rejects 'Carnevale di Venezia'", () => {
      expect(isNonSagraTitle("Carnevale di Venezia")).toBe(true);
    });

    it("rejects 'Mostra di pittura'", () => {
      expect(isNonSagraTitle("Mostra di pittura")).toBe(true);
    });

    it("rejects 'Concerto rock in piazza'", () => {
      expect(isNonSagraTitle("Concerto rock in piazza")).toBe(true);
    });

    it("rejects 'Mercatino dell'antiquariato'", () => {
      expect(isNonSagraTitle("Mercatino dell'antiquariato")).toBe(true);
    });

    it("rejects 'Teatro Goldoni presenta...'", () => {
      expect(isNonSagraTitle("Teatro Goldoni presenta...")).toBe(true);
    });

    it("rejects 'Maratona della Citta'", () => {
      expect(isNonSagraTitle("Maratona della Citta")).toBe(true);
    });
  });

  describe("allows sagre with secondary activity keywords (whitelist)", () => {
    it("allows 'Sagra e Fiera del Radicchio'", () => {
      expect(isNonSagraTitle("Sagra e Fiera del Radicchio")).toBe(false);
    });

    it("allows 'Festa con Concerto dal Vivo'", () => {
      expect(isNonSagraTitle("Festa con Concerto dal Vivo")).toBe(false);
    });

    it("allows 'Sagra del Mercato Antico'", () => {
      expect(isNonSagraTitle("Sagra del Mercato Antico")).toBe(false);
    });

    it("allows 'Festa Gastronomica del Pesce'", () => {
      expect(isNonSagraTitle("Festa Gastronomica del Pesce")).toBe(false);
    });

    it("allows 'Degustazione e Mostra dei Vini'", () => {
      expect(isNonSagraTitle("Degustazione e Mostra dei Vini")).toBe(false);
    });

    it("allows 'Sagra del Baccala alla Vicentina'", () => {
      expect(isNonSagraTitle("Sagra del Baccala alla Vicentina")).toBe(false);
    });

    it("allows 'Festa della Polenta'", () => {
      expect(isNonSagraTitle("Festa della Polenta")).toBe(false);
    });
  });

  describe("handles edge cases", () => {
    it("returns false for empty string", () => {
      expect(isNonSagraTitle("")).toBe(false);
    });

    it("returns false for null input", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(isNonSagraTitle(null as any)).toBe(false);
    });
  });
});

describe("isCalendarDateRange", () => {
  describe("rejects full month ranges", () => {
    it("rejects January full month (2026-01-01 to 2026-01-31)", () => {
      expect(isCalendarDateRange("2026-01-01", "2026-01-31")).toBe(true);
    });

    it("rejects February full month (2026-02-01 to 2026-02-28)", () => {
      expect(isCalendarDateRange("2026-02-01", "2026-02-28")).toBe(true);
    });

    it("rejects March full month (2026-03-01 to 2026-03-31)", () => {
      expect(isCalendarDateRange("2026-03-01", "2026-03-31")).toBe(true);
    });

    it("rejects near-full month range (2026-04-01 to 2026-04-29)", () => {
      expect(isCalendarDateRange("2026-04-01", "2026-04-29")).toBe(true);
    });
  });

  describe("accepts normal sagra ranges", () => {
    it("accepts 3-day sagra (2026-04-24 to 2026-04-26)", () => {
      expect(isCalendarDateRange("2026-04-24", "2026-04-26")).toBe(false);
    });

    it("accepts range starting on 1st but ending on 3rd (2026-06-01 to 2026-06-03)", () => {
      expect(isCalendarDateRange("2026-06-01", "2026-06-03")).toBe(false);
    });

    it("accepts weekend sagra (2026-07-11 to 2026-07-13)", () => {
      expect(isCalendarDateRange("2026-07-11", "2026-07-13")).toBe(false);
    });
  });

  describe("handles null dates", () => {
    it("returns false when both dates are null", () => {
      expect(isCalendarDateRange(null, null)).toBe(false);
    });

    it("returns false when start date is null", () => {
      expect(isCalendarDateRange(null, "2026-01-31")).toBe(false);
    });

    it("returns false when end date is null", () => {
      expect(isCalendarDateRange("2026-01-01", null)).toBe(false);
    });
  });
});

describe("isExcessiveDuration", () => {
  describe("rejects events longer than maxDays (default 7)", () => {
    it("rejects 14-day event", () => {
      expect(isExcessiveDuration("2026-01-01", "2026-01-15")).toBe(true);
    });

    it("rejects 8-day event", () => {
      expect(isExcessiveDuration("2026-05-01", "2026-05-09")).toBe(true);
    });

    it("rejects month-long event", () => {
      expect(isExcessiveDuration("2026-06-01", "2026-06-30")).toBe(true);
    });
  });

  describe("accepts events up to maxDays", () => {
    it("accepts 2-day sagra", () => {
      expect(isExcessiveDuration("2026-04-24", "2026-04-26")).toBe(false);
    });

    it("accepts exactly 7-day event (boundary)", () => {
      expect(isExcessiveDuration("2026-04-24", "2026-05-01")).toBe(false);
    });

    it("accepts single-day event (same start and end)", () => {
      expect(isExcessiveDuration("2026-04-24", "2026-04-24")).toBe(false);
    });
  });

  describe("custom maxDays parameter", () => {
    it("rejects 4-day event when maxDays is 3", () => {
      expect(isExcessiveDuration("2026-04-24", "2026-04-28", 3)).toBe(true);
    });

    it("accepts 3-day event when maxDays is 3", () => {
      expect(isExcessiveDuration("2026-04-24", "2026-04-27", 3)).toBe(false);
    });
  });

  describe("handles null dates", () => {
    it("returns false when both dates are null", () => {
      expect(isExcessiveDuration(null, null)).toBe(false);
    });

    it("returns false when start date is null", () => {
      expect(isExcessiveDuration(null, "2026-01-15")).toBe(false);
    });

    it("returns false when end date is null", () => {
      expect(isExcessiveDuration("2026-01-01", null)).toBe(false);
    });
  });
});

describe("isPastYearEvent", () => {
  const currentYear = new Date().getFullYear();

  describe("rejects past year events", () => {
    it("rejects event from 2025", () => {
      expect(isPastYearEvent("2025-08-15", "2025-08-17")).toBe(true);
    });

    it("rejects event with only past start date", () => {
      expect(isPastYearEvent("2025-12-20", null)).toBe(true);
    });

    it("rejects event with only past end date", () => {
      expect(isPastYearEvent(null, "2025-06-30")).toBe(true);
    });

    it("rejects event from 2024", () => {
      expect(isPastYearEvent("2024-07-01", "2024-07-03")).toBe(true);
    });
  });

  describe("accepts current year events", () => {
    it("accepts event in current year", () => {
      expect(
        isPastYearEvent(`${currentYear}-04-24`, `${currentYear}-04-26`)
      ).toBe(false);
    });

    it("accepts event with only current year start date", () => {
      expect(isPastYearEvent(`${currentYear}-06-01`, null)).toBe(false);
    });

    it("accepts event with only current year end date", () => {
      expect(isPastYearEvent(null, `${currentYear}-09-15`)).toBe(false);
    });
  });

  describe("handles null dates", () => {
    it("returns false when both dates are null", () => {
      expect(isPastYearEvent(null, null)).toBe(false);
    });
  });
});

describe("tryUpgradeImageUrl", () => {
  describe("sagritaly WordPress thumbnail stripping", () => {
    it("removes WordPress -WxH suffix", () => {
      expect(
        tryUpgradeImageUrl(
          "https://sagritaly.com/wp-content/uploads/2026/03/polenta-150x150.jpg",
          "sagritaly"
        )
      ).toBe("https://sagritaly.com/wp-content/uploads/2026/03/polenta.jpg");
    });

    it("handles larger WordPress dimensions", () => {
      expect(
        tryUpgradeImageUrl(
          "https://sagritaly.com/wp-content/uploads/2026/01/img-300x200.jpeg",
          "sagritaly"
        )
      ).toBe("https://sagritaly.com/wp-content/uploads/2026/01/img.jpeg");
    });

    it("does not modify sagritaly URLs without WordPress suffix", () => {
      const url = "https://sagritaly.com/wp-content/uploads/2026/03/polenta.jpg";
      expect(tryUpgradeImageUrl(url, "sagritaly")).toBe(url);
    });
  });

  describe("solosagre size param stripping", () => {
    it("removes w/h/resize query params", () => {
      expect(
        tryUpgradeImageUrl(
          "https://solosagre.it/images/photo.jpg?w=150&h=100&resize=150x100",
          "solosagre"
        )
      ).toBe("https://solosagre.it/images/photo.jpg");
    });

    it("preserves solosagre URLs without size params", () => {
      const url = "https://solosagre.it/images/photo.jpg";
      expect(tryUpgradeImageUrl(url, "solosagre")).toBe(url);
    });
  });

  describe("unknown sources", () => {
    it("passes through unknown sources unchanged", () => {
      const url = "https://example.com/image-150x150.jpg?w=100";
      expect(tryUpgradeImageUrl(url, "venetoinfesta")).toBe(url);
    });
  });

  describe("null and empty handling", () => {
    it("returns null for null input", () => {
      expect(tryUpgradeImageUrl(null, "sagritaly")).toBeNull();
    });

    it("returns null for empty string input", () => {
      expect(tryUpgradeImageUrl("", "sagritaly")).toBeNull();
    });
  });
});
