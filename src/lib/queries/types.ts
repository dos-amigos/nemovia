/**
 * Query parameter and result types for the sagra data access layer.
 */

import type { Sagra } from "@/types/database";

/** Filters for the search/browse sagre query. */
export interface SearchFilters {
  provincia?: string;
  cucina?: string;
  gratis?: boolean;
  da?: string;
  a?: string;
  lat?: number;
  lng?: number;
  raggio?: number;
}

/**
 * Subset of Sagra fields needed by the SagraCard component.
 * Keeps data transfer lean -- only what the card renders.
 */
export type SagraCardData = Pick<
  Sagra,
  | "id"
  | "title"
  | "slug"
  | "location_text"
  | "province"
  | "start_date"
  | "end_date"
  | "enhanced_description"
  | "food_tags"
  | "image_url"
  | "is_free"
  | "price_info"
> & {
  distance_km?: number;
};

/**
 * Subset of Sagra fields needed by the map marker and popup.
 * Keeps map data transfer lean -- only what pins and popups render.
 */
export type MapMarkerData = Pick<
  Sagra,
  | "id"
  | "slug"
  | "title"
  | "location_text"
  | "province"
  | "start_date"
  | "end_date"
  | "food_tags"
  | "location"
  | "is_free"
>;

/** Province name with its active sagra count. */
export interface ProvinceCount {
  province: string;
  count: number;
}
