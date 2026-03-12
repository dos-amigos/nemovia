import comuniData from "@/../public/data/veneto-comuni.json";

export interface VenetoComune {
  nome: string;
  provincia: string;
  lat: number;
  lng: number;
}

export const VENETO_COMUNI: VenetoComune[] = comuniData as VenetoComune[];

/**
 * Filter comuni by name match.
 * Returns empty array for queries shorter than 2 characters.
 * Case-insensitive: prioritizes startsWith matches, then includes matches.
 */
export function filterComuni(query: string, limit = 8): VenetoComune[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();

  const starts: VenetoComune[] = [];
  const contains: VenetoComune[] = [];

  for (const c of VENETO_COMUNI) {
    const name = c.nome.toLowerCase();
    if (name.startsWith(q)) {
      starts.push(c);
    } else if (name.includes(q)) {
      contains.push(c);
    }
  }

  return [...starts, ...contains].slice(0, limit);
}
