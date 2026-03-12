import { parseAsString, parseAsInteger, parseAsBoolean } from "nuqs";

/** Shared filter URL-param parsers used by SearchFilters and ActiveFilters. */
export const filterParsers = {
  provincia: parseAsString,
  raggio: parseAsInteger.withDefault(30),
  cucina: parseAsString,
  gratis: parseAsBoolean,
  da: parseAsString,
  a: parseAsString,
  lat: parseAsString, // stored as string in URL, parsed to number by server
  lng: parseAsString,
  cityName: parseAsString,
};
