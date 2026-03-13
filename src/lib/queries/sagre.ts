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

/** Remove duplicate sagre by title (keeps first occurrence). */
function deduplicateByTitle<T extends { title: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Fetch active sagre happening soon (today through next Sunday).
 * Covers the current weekend even if today is early in the week.
 * Catches multi-day sagre whose start_date is in the past but end_date
 * is in the future (or null, treated as single-day).
 */
export async function getWeekendSagre(limit = 12): Promise<SagraCardData[]> {
  try {
    const supabase = await createClient();

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    // Next Sunday: days until Sunday (0=Sun, so 7-day%7, but if Sunday give 0)
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const nextSunday = new Date(now.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data, error } = await supabase
      .from("sagre")
      .select(SAGRA_CARD_FIELDS)
      .eq("is_active", true)
      .not("province", "is", null)
      .or(`end_date.gte.${today},end_date.is.null`)
      .lte("start_date", nextSunday)
      .order("start_date", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("getWeekendSagre error:", error.message);
      return [];
    }

    return deduplicateByTitle((data as SagraCardData[]) ?? []);
  } catch (err) {
    console.error("getWeekendSagre unexpected error:", err);
    return [];
  }
}

/**
 * Fetch all active, non-expired sagre across all categories.
 * Used as a broad pool for Netflix-style scroll row categorization.
 * Ordered by start_date ascending so nearest events appear first.
 */
export async function getActiveSagre(limit = 80): Promise<SagraCardData[]> {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("sagre")
      .select(SAGRA_CARD_FIELDS)
      .eq("is_active", true)
      .not("province", "is", null)
      .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`)
      .order("start_date", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("getActiveSagre error:", error.message);
      return [];
    }

    return deduplicateByTitle((data as SagraCardData[]) ?? []);
  } catch (err) {
    console.error("getActiveSagre unexpected error:", err);
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

      return deduplicateByTitle(results);
    }

    // Standard query with chained filters
    const today = new Date().toISOString().split("T")[0];

    let query = supabase
      .from("sagre")
      .select(SAGRA_CARD_FIELDS)
      .eq("is_active", true)
      .not("province", "is", null);

    // Apply date filter BEFORE optional filters to avoid PostgREST .or() precedence issues
    if (da) {
      query = query.gte("end_date", da);
    } else {
      // Default: hide past events (end_date >= today, or single-day with start_date >= today)
      query = query.or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`);
    }
    if (a) {
      query = query.lte("start_date", a);
    }

    if (provincia) {
      query = query.eq("province", provincia);
    }
    if (cucina) {
      query = query.contains("food_tags", [cucina]);
    }
    if (gratis) {
      query = query.eq("is_free", true);
    }

    const { data, error } = await query
      .order("start_date", { ascending: true })
      .limit(50);

    if (error) {
      console.error("searchSagre query error:", error.message);
      return [];
    }

    return deduplicateByTitle((data as SagraCardData[]) ?? []);
  } catch (err) {
    console.error("searchSagre unexpected error:", err);
    return [];
  }
}

/**
 * Get active, non-expired sagra counts grouped by province.
 * Used for province filter chips showing availability.
 * Replaces RPC with direct query to include date filtering.
 */
export async function getProvinceCounts(): Promise<ProvinceCount[]> {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("sagre")
      .select("province, title")
      .eq("is_active", true)
      .not("province", "is", null)
      .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`);

    if (error) {
      console.error("getProvinceCounts error:", error.message);
      return [];
    }

    // Deduplicate by title (same logic as searchSagre) then count
    const deduplicated = deduplicateByTitle(data ?? []);
    const counts = new Map<string, number>();
    for (const row of deduplicated) {
      const p = row.province as string;
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([province, count]) => ({ province, count }))
      .sort((a, b) => b.count - a.count) as ProvinceCount[];
  } catch (err) {
    console.error("getProvinceCounts unexpected error:", err);
    return [];
  }
}

/**
 * Search sagre for map rendering with optional filters.
 * Mirrors searchSagre logic but selects MAP_MARKER_FIELDS and returns MapMarkerData[].
 * When no filters are active, returns all active sagre with location (same as getMapSagre).
 */
export async function searchMapSagre(
  filters: SearchFilters
): Promise<MapMarkerData[]> {
  try {
    const supabase = await createClient();
    const { provincia, cucina, gratis, da, a, lat, lng, raggio } = filters;

    // Spatial search via PostGIS RPC
    if (lat != null && lng != null) {
      const { data, error } = await supabase.rpc("find_nearby_sagre", {
        user_lat: lat,
        user_lng: lng,
        radius_meters: (raggio ?? 30) * 1000,
        max_results: 200,
      });

      if (error) {
        console.error("searchMapSagre RPC error:", error.message);
        return [];
      }

      let results = (data ?? []) as Array<Record<string, unknown>>;
      const today = new Date().toISOString().split("T")[0];

      // Default: hide past events
      if (!da) {
        results = results.filter(
          (s) =>
            (s.end_date != null && (s.end_date as string) >= today) ||
            (s.end_date == null &&
              s.start_date != null &&
              (s.start_date as string) >= today)
        );
      }

      // Apply additional filters in-memory on RPC results
      if (provincia) {
        results = results.filter((s) => s.province === provincia);
      }
      if (cucina) {
        results = results.filter((s) =>
          (s.food_tags as string[] | null)?.includes(cucina)
        );
      }
      if (gratis) {
        results = results.filter((s) => s.is_free === true);
      }
      if (da) {
        results = results.filter(
          (s) => s.end_date == null || (s.end_date as string) >= da
        );
      }
      if (a) {
        results = results.filter(
          (s) => s.start_date == null || (s.start_date as string) <= a
        );
      }

      // Map to MapMarkerData with parsed WKB location
      const mapped = results
        .filter((r) => r.location != null)
        .map((r) => ({
          ...r,
          location: parseWKBPoint(r.location as string),
        })) as MapMarkerData[];

      return deduplicateByTitle(mapped);
    }

    // Standard query with chained filters
    const today = new Date().toISOString().split("T")[0];

    let query = supabase
      .from("sagre")
      .select(MAP_MARKER_FIELDS)
      .eq("is_active", true)
      .not("location", "is", null);

    // Apply date filter BEFORE optional filters to avoid PostgREST .or() precedence issues
    if (da) {
      query = query.gte("end_date", da);
    } else {
      // Default: hide past events
      query = query.or(
        `end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`
      );
    }
    if (a) {
      query = query.lte("start_date", a);
    }

    if (provincia) {
      query = query.eq("province", provincia);
    }
    if (cucina) {
      query = query.contains("food_tags", [cucina]);
    }
    if (gratis) {
      query = query.eq("is_free", true);
    }

    const { data, error } = await query.order("start_date", {
      ascending: true,
    });

    if (error) {
      console.error("searchMapSagre query error:", error.message);
      return [];
    }

    const mapped = (data ?? []).map((row) => ({
      ...row,
      location: parseWKBPoint(row.location as unknown as string),
    })) as MapMarkerData[];

    return deduplicateByTitle(mapped);
  } catch (err) {
    console.error("searchMapSagre unexpected error:", err);
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
