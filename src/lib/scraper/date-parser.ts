const ITALIAN_MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6,
  lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
};

function toIso(day: number, month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseItalianDateRange(raw: string): { start: string | null; end: string | null } {
  if (!raw) return { start: null, end: null };
  const s = raw.toLowerCase().trim();

  // Pattern 1: DD/MM/YYYY [al|al DD/MM/YYYY]
  // Handles: "24/04/2026 al 26/04/2026", "Dal 08/03/2026 Al 08/03/2026", "Il 08/03/2026"
  const slashMatch = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:.*?(\d{1,2})\/(\d{1,2})\/(\d{4}))?/);
  if (slashMatch) {
    const start = toIso(+slashMatch[1], +slashMatch[2], +slashMatch[3]);
    const end = slashMatch[4]
      ? toIso(+slashMatch[4], +slashMatch[5], +slashMatch[6])
      : start;
    return { start, end };
  }

  // Pattern 2: DD[-DD] MonthName YYYY (e.g. "24 Aprile 2026", "24-26 Aprile 2026")
  const wordMatch = s.match(/(\d{1,2})(?:-(\d{1,2}))?\s+([a-z]+)\s+(\d{4})/);
  if (wordMatch) {
    const monthNum = ITALIAN_MONTHS[wordMatch[3]];
    if (monthNum) {
      const startDay = +wordMatch[1];
      const endDay = wordMatch[2] ? +wordMatch[2] : startDay;
      const year = +wordMatch[4];
      return {
        start: toIso(startDay, monthNum, year),
        end: toIso(endDay, monthNum, year),
      };
    }
  }

  return { start: null, end: null };
}
