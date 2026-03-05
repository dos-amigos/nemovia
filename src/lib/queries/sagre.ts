/**
 * Server-side Supabase query functions for sagre data.
 * All functions return empty arrays on error for graceful degradation.
 */

import { createClient } from "@/lib/supabase/server";
import { SAGRA_CARD_FIELDS } from "@/lib/constants/veneto";
import type { SagraCardData, SearchFilters, ProvinceCount } from "./types";

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
