import comuniData from "@/../public/data/veneto-comuni.json";

export interface VenetoComune {
  nome: string;
  provincia: string;
  lat: number;
  lng: number;
}

export const VENETO_COMUNI: VenetoComune[] = comuniData as VenetoComune[];

/**
 * Filter comuni by prefix match on name.
 * Returns empty array for queries shorter than 2 characters.
 * Case-insensitive startsWith matching.
 */
export function filterComuni(query: string, limit = 8): VenetoComune[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return VENETO_COMUNI.filter((c) => c.nome.toLowerCase().startsWith(q)).slice(
    0,
    limit
  );
}
