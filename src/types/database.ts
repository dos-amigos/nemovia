export interface Sagra {
  id: string;
  title: string;
  slug: string;
  location_text: string;
  location: { type: string; coordinates: [number, number] } | null; // GeoJSON from PostGIS
  province: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  enhanced_description: string | null;
  source_description: string | null;
  menu_text: string | null;
  orari_text: string | null;
  food_tags: string[] | null;
  feature_tags: string[] | null;
  image_url: string | null;
  image_credit: string | null;
  source_url: string | null;
  is_free: boolean | null;
  price_info: string | null;
  status: string;
  content_hash: string;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export type SagraInsert = Omit<Sagra, "id" | "created_at" | "updated_at">;
export type SagraUpdate = Partial<Omit<Sagra, "id" | "created_at">>;
