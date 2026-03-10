/**
 * Server-side Supabase query functions for sagre data.
 * All functions return empty arrays on error for graceful degradation.
 */

import { createClient } from "@/lib/supabase/server";
import { SAGRA_CARD_FIELDS, MAP_MARKER_FIELDS } from "@/lib/constants/veneto";
import type { Sagra } from "@/types/database";
import type {
  SagraCardData,
  MapMarkerData,
  SearchFilters,
  ProvinceCount,
} from "./types";

/**
 * Parse PostGIS EWKB hex (Point, SRID 4326) into GeoJSON.
 * PostgREST returns geography columns as WKB hex, not GeoJSON.
 */
function parseWKBPoint(
  wkb: string
): { type: string; coordinates: [number, number] } | null {
  if (!wkb || wkb.length < 50) return null;
  const buf = Buffer.from(wkb, "hex");
  const lng = buf.readDoubleLE(9);
  const lat = buf.readDoubleLE(17);
  return { type: "Point", coordinates: [lng, lat] };
}

/**
 * Fetch active sagre happening this weekend (today through +3 days).
 * Catches multi-day sagre whose start_date is in the past but end_date
 * is in the future (or null, treated as single-day).
 */
export async function getWeekendSagre(): Promise<SagraCardData[]> {
  try {
    const supabase = await createClient();

    const today = new Date().toISOString().split("T")[0];
    const threeDaysOut = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data, error } = await supabase
      .from("sagre")
      .select(SAGRA_CARD_FIELDS)
      .eq("is_active", true)
      .or(`end_date.gte.${today},end_date.is.null`)
      .lte("start_date", threeDaysOut)
      .order("start_date", { ascending: true })
      .limit(8);

    if (error) {
      console.error("getWeekendSagre error:", error.message);
      return [];
    }

    return (data as SagraCardData[]) ?? [];
  } catch (err) {
    console.error("getWeekendSagre unexpected error:", err);
    return [];
  }
}

/**
 * Search sagre with optional filters.
 * When lat/lng are provided, uses the PostGIS RPC for distance-sorted results
 * and applies additional filters in-memory.
 * Otherwise, builds a standard Supabase query with chained filters.
 */
export async function searchSagre(
  filters: SearchFilters
): Promise<SagraCardData[]> {
  try {
    const supabase = await createClient();
    const { provincia, cucina, gratis, da, a, lat, lng, raggio } = filters;

    // Spatial search via PostGIS RPC
    if (lat != null && lng != null) {
      const { data, error } = await supabase.rpc("find_nearby_sagre", {
        user_lat: lat,
        user_lng: lng,
        radius_meters: (raggio ?? 30) * 1000,
        max_results: 50,
      });

      if (error) {
        console.error("searchSagre RPC error:", error.message);
        return [];
      }

      let results = (data as SagraCardData[]) ?? [];
      const today = new Date().toISOString().split("T")[0];

      // Default: hide past events
      if (!da) {
        results = results.filter(
          (s) =>
            (s.end_date != null && s.end_date >= today) ||
            (s.end_date == null && s.start_date != null && s.start_date >= today)
        );
      }

      // Apply additional filters in-memory on RPC results
      if (provincia) {
        results = results.filter((s) => s.province === provincia);
      }
      if (cucina) {
        results = results.filter((s) => s.food_tags?.includes(cucina));
      }
      if (gratis) {
        results = results.filter((s) => s.is_free === true);
      }
      if (da) {
        results = results.filter(
          (s) => s.end_date == null || s.end_date >= da
        );
      }
      if (a) {
        results = results.filter(
          (s) => s.start_date == null || s.start_date <= a
        );
      }

      return results;
    }

    // Standard query with chained filters
    const today = new Date().toISOString().split("T")[0];

    let query = supabase
      .from("sagre")
      .select(SAGRA_CARD_FIELDS)
      .eq("is_active", true);

    if (provincia) {
      query = query.eq("province", provincia);
    }
    if (cucina) {
      query = query.contains("food_tags", [cucina]);
    }
    if (gratis) {
      query = query.eq("is_free", true);
    }
    if (da) {
      query = query.gte("end_date", da);
    } else {
      // Default: hide past events (end_date >= today, or single-day with start_date >= today)
      query = query.or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`);
    }
    if (a) {
      query = query.lte("start_date", a);
    }

    const { data, error } = await query
      .order("start_date", { ascending: true })
      .limit(50);

    if (error) {
      console.error("searchSagre query error:", error.message);
      return [];
    }

    return (data as SagraCardData[]) ?? [];
  } catch (err) {
    console.error("searchSagre unexpected error:", err);
    return [];
  }
}

/**
 * Get active sagra counts grouped by province.
 * Used for province filter chips showing availability.
 */
export async function getProvinceCounts(): Promise<ProvinceCount[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("count_sagre_by_province");

    if (error) {
      console.error("getProvinceCounts error:", error.message);
      return [];
    }

    return (data as ProvinceCount[]) ?? [];
  } catch (err) {
    console.error("getProvinceCounts unexpected error:", err);
    return [];
  }
}

/**
 * Fetch all active sagre with non-null location for map rendering.
 * Returns only the lean marker fields needed by MapView.
 */
export async function getMapSagre(): Promise<MapMarkerData[]> {
  try {
    const supabase = await createClient();

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("sagre")
      .select(MAP_MARKER_FIELDS)
      .eq("is_active", true)
      .not("location", "is", null)
      .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`);

    if (error) {
      console.error("getMapSagre error:", error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      ...row,
      location: parseWKBPoint(row.location as unknown as string),
    })) as MapMarkerData[];
  } catch (err) {
    console.error("getMapSagre unexpected error:", err);
    return [];
  }
}

/**
 * Fetch a single active sagra by slug.
 * Returns the full Sagra row (all fields) for the detail page.
 */
export async function getSagraBySlug(slug: string): Promise<Sagra | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sagre")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error) {
      console.error("getSagraBySlug error:", error.message);
      return null;
    }

    const sagra = data as Sagra;
    if (sagra?.location && typeof sagra.location === "string") {
      sagra.location = parseWKBPoint(sagra.location as unknown as string);
    }
    return sagra;
  } catch (err) {
    console.error("getSagraBySlug unexpected error:", err);
    return null;
  }
}
