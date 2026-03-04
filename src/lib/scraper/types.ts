// Mirrors scraper_sources table schema (Supabase DB)
export interface ScraperSource {
  id: string;
  name: string;
  display_name: string;
  base_url: string;
  selector_item: string;
  selector_title: string;
  selector_start_date: string | null;
  selector_end_date: string | null;
  selector_city: string | null;
  selector_price: string | null;
  selector_url: string | null;
  selector_image: string | null;
  url_pattern: string | null;     // e.g. '?page={n}' or '/page/{n}/'
  next_page_selector: string | null;
  max_pages: number;
  is_active: boolean;
  consecutive_failures: number;
  last_scraped_at: string | null;
}

// Raw data extracted from HTML before normalization
export interface RawEvent {
  title: string;
  dateText: string;        // Raw date string from source (e.g. "24/04/2026 al 26/04/2026")
  city: string;
  price: string | null;
  url: string | null;
  image: string | null;
}

// Normalized data ready for Supabase upsert
export interface NormalizedEvent {
  title: string;
  normalizedTitle: string;
  slug: string;
  city: string;
  startDate: string | null;   // ISO date: 'YYYY-MM-DD' or null
  endDate: string | null;     // ISO date: 'YYYY-MM-DD' or null
  priceInfo: string | null;
  isFree: boolean | null;
  imageUrl: string | null;
  url: string | null;
  contentHash: string;
}

// Result of scraping one source
export interface ScrapeSummary {
  sourceId: string;
  sourceName: string;
  status: "success" | "error" | "skipped";
  eventsFound: number;
  eventsInserted: number;
  eventsMerged: number;
  errorMessage: string | null;
  durationMs: number;
}
