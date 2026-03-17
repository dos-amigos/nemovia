"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_COOKIE = "nemovia_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Verify admin password and set session cookie */
export async function loginAction(password: string): Promise<{ ok: boolean }> {
  if (password === process.env.ADMIN_PASSWORD) {
    const store = await cookies();
    store.set(ADMIN_COOKIE, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/admin",
    });
    return { ok: true };
  }
  return { ok: false };
}

/** Check if admin session is active */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === "1";
}

/** Logout */
export async function logoutAction() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export type ReviewStatus = "pending" | "auto_approved" | "needs_review" | "admin_approved" | "admin_rejected" | "discarded";

/** Fetch sagre for admin review */
export async function getAdminSagre(
  status: ReviewStatus | "all",
  page: number = 0,
  pageSize: number = 50,
) {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  let query = db
    .from("sagre")
    .select("id, title, slug, location_text, province, start_date, end_date, food_tags, feature_tags, image_url, source_url, source_id, confidence, review_status, is_active, is_free, enhanced_description, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (status !== "all") {
    query = query.eq("review_status", status);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { data: data ?? [], total: count ?? 0 };
}

/** Get single sagra with all fields for editing */
export async function getAdminSagraById(id: string) {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const { data, error } = await db
    .from("sagre")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/** Approve a sagra */
export async function approveAction(id: string) {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const { error } = await db
    .from("sagre")
    .update({ review_status: "admin_approved", is_active: true, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/** Reject a sagra */
export async function rejectAction(id: string) {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const { error } = await db
    .from("sagre")
    .update({ review_status: "admin_rejected", is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/** Update sagra fields */
export async function updateSagraAction(
  id: string,
  fields: {
    title?: string;
    location_text?: string;
    province?: string;
    start_date?: string | null;
    end_date?: string | null;
    enhanced_description?: string | null;
    food_tags?: string[];
    feature_tags?: string[];
    image_url?: string | null;
    is_free?: boolean;
  },
) {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const { error } = await db
    .from("sagre")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/** Bulk approve all auto_approved sagre */
export async function bulkApproveAutoAction() {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const { error, count } = await db
    .from("sagre")
    .update({ review_status: "admin_approved", updated_at: new Date().toISOString() })
    .eq("review_status", "auto_approved");

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Get review status counts */
export async function getStatusCounts(): Promise<Record<string, number>> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const statuses: ReviewStatus[] = ["pending", "auto_approved", "needs_review", "admin_approved", "admin_rejected", "discarded"];
  const counts: Record<string, number> = {};

  for (const s of statuses) {
    const { count } = await db
      .from("sagre")
      .select("id", { count: "exact", head: true })
      .eq("review_status", s);
    counts[s] = count ?? 0;
  }

  return counts;
}
