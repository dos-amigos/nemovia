import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ITALIAN_MONTHS = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
] as const;

/**
 * Format a date range in Italian style.
 * Single day: "5 mar 2026"
 * Same month: "5 - 12 mar 2026"
 * Cross-month: "28 feb - 5 mar 2026"
 */
export function formatDateRange(
  startDate: string | null,
  endDate: string | null
): string {
  if (!startDate) return "Date da confermare";

  const start = new Date(startDate + "T00:00:00");
  const startDay = start.getDate();
  const startMonth = ITALIAN_MONTHS[start.getMonth()];
  const startYear = start.getFullYear();

  // Single day: no end date, or end date equals start date
  if (!endDate || endDate === startDate) {
    return `${startDay} ${startMonth} ${startYear}`;
  }

  const end = new Date(endDate + "T00:00:00");
  const endDay = end.getDate();
  const endMonth = ITALIAN_MONTHS[end.getMonth()];
  const endYear = end.getFullYear();

  // Same month and year
  if (start.getMonth() === end.getMonth() && startYear === endYear) {
    return `${startDay} - ${endDay} ${endMonth} ${endYear}`;
  }

  // Cross-month (same year or different year)
  if (startYear === endYear) {
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${endYear}`;
  }

  return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
}
