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

/** Get single sagra with all fields for editing (excludes PostGIS location — not serializable in server actions) */
export async function getAdminSagraById(id: string) {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const { data, error } = await db
    .from("sagre")
    .select("id, title, slug, location_text, province, start_date, end_date, food_tags, feature_tags, image_url, image_credit, source_url, source_id, confidence, review_status, is_active, is_free, enhanced_description, source_description, description, status, created_at, unsplash_query")
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

/** Get pipeline stats — how many are in each enrichment stage */
export async function getPipelineStats(): Promise<{
  total: number;
  pending_geocode: number;
  pending_llm: number;
  enriched: number;
  with_image: number;
  active: number;
}> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const today = new Date().toISOString().split("T")[0];
  const lookback = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [total, pgeo, pllm, enr, img, active] = await Promise.all([
    db.from("sagre").select("id", { count: "exact", head: true }),
    db.from("sagre").select("id", { count: "exact", head: true }).eq("status", "pending_geocode"),
    db.from("sagre").select("id", { count: "exact", head: true }).in("status", ["pending_llm", "geocode_failed"]),
    db.from("sagre").select("id", { count: "exact", head: true }).eq("status", "enriched"),
    db.from("sagre").select("id", { count: "exact", head: true }).not("image_url", "is", null),
    // Match frontend logic: is_active + approved + province + future/recent dates
    db.from("sagre").select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .in("review_status", ["auto_approved", "admin_approved"])
      .not("province", "is", null)
      .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${lookback}),and(end_date.is.null,start_date.is.null)`),
  ]);

  return {
    total: total.count ?? 0,
    pending_geocode: pgeo.count ?? 0,
    pending_llm: pllm.count ?? 0,
    enriched: enr.count ?? 0,
    with_image: img.count ?? 0,
    active: active.count ?? 0,
  };
}

/** Trigger enrich-sagre edge function */
export async function triggerEnrichment(): Promise<string> {
  if (!(await isAdmin())) throw new Error("Unauthorized");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(`${url}/functions/v1/enrich-sagre`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) return `Errore: ${res.status} ${res.statusText}`;
  const data = await res.json();
  return data.status ?? "triggered";
}

/** Get last enrichment logs from scrape_logs table */
export async function getLastEnrichmentLogs(limit: number = 5) {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const { data } = await db
    .from("scrape_logs")
    .select("id, source, started_at, completed_at, sagre_found, sagre_inserted, sagre_updated, error_message")
    .eq("source", "enrich-sagre")
    .order("started_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

/** Get enrich pipeline run logs */
export async function getEnrichLogs(limit: number = 10) {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const { data, error } = await db
    .from("enrich_logs")
    .select("*")
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("enrich_logs query error:", error.message);
    return [];
  }
  return data ?? [];
}

// ============================================================
// System control: pg_cron, scrapers, diagnostics
// ============================================================

export type CronJob = {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: string | null;
  last_status: string | null;
};

/** Get pg_cron job statuses via raw SQL */
export async function getCronJobs(): Promise<CronJob[]> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  // Query cron.job for schedules + cron.job_run_details for last run
  const { data, error } = await db.rpc("get_cron_jobs");
  if (error) {
    // RPC might not exist yet — try direct query as fallback
    console.error("get_cron_jobs RPC error:", error.message);
    return [];
  }
  return (data ?? []) as CronJob[];
}

/** Toggle a pg_cron job active/inactive */
export async function toggleCronJob(jobname: string, active: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const action = active ? "cron.schedule" : "cron.unschedule";
  // Use ALTER to toggle — simpler than unschedule/reschedule
  const { error } = await db.rpc("toggle_cron_job", { job_name: jobname, is_active: active });
  if (error) {
    console.error(`toggle_cron_job error:`, error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Trigger any edge function by name */
export async function triggerEdgeFunction(functionName: string): Promise<string> {
  if (!(await isAdmin())) throw new Error("Unauthorized");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  try {
    const res = await fetch(`${url}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trigger: "admin" }),
    });

    if (!res.ok) return `Errore: ${res.status} ${res.statusText}`;
    return "started";
  } catch (e) {
    return `Errore: ${(e as Error).message}`;
  }
}

/** Trigger GitHub Actions workflow */
export async function triggerGitHubAction(script: string): Promise<string> {
  if (!(await isAdmin())) throw new Error("Unauthorized");

  // GitHub PAT needed for workflow_dispatch — use service-level approach
  // For now, we can't trigger GH Actions from server without a PAT
  // Instead, we document this limitation
  return "not_available";
}

export type DbDiagnostics = {
  total_sagre: number;
  active_sagre: number;
  future_sagre: number;
  expired_sagre: number;
  no_date_sagre: number;
  no_province: number;
  no_image: number;
  by_source: { source: string; count: number }[];
  by_review_status: { status: string; count: number }[];
  by_province: { province: string; count: number }[];
};

/** Full DB diagnostics for admin panel */
export async function getDbDiagnostics(): Promise<DbDiagnostics> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const [total, active, future, expired, noDate, noProv, noImg] = await Promise.all([
    db.from("sagre").select("id", { count: "exact", head: true }),
    db.from("sagre").select("id", { count: "exact", head: true }).eq("is_active", true),
    db.from("sagre").select("id", { count: "exact", head: true }).gte("end_date", today),
    db.from("sagre").select("id", { count: "exact", head: true }).lt("end_date", today),
    db.from("sagre").select("id", { count: "exact", head: true }).is("start_date", null),
    db.from("sagre").select("id", { count: "exact", head: true }).is("province", null),
    db.from("sagre").select("id", { count: "exact", head: true }).is("image_url", null).eq("is_active", true),
  ]);

  // Source breakdown — get source_id counts
  const { data: sourceRows } = await db
    .from("sagre")
    .select("source_id")
    .not("source_id", "is", null);

  const sourceCounts = new Map<string, number>();
  for (const r of sourceRows ?? []) {
    const s = (r.source_id as string) ?? "unknown";
    sourceCounts.set(s, (sourceCounts.get(s) ?? 0) + 1);
  }
  const bySource = [...sourceCounts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // Province breakdown for active sagre
  const { data: provRows } = await db
    .from("sagre")
    .select("province")
    .eq("is_active", true)
    .not("province", "is", null);

  const provCounts = new Map<string, number>();
  for (const r of provRows ?? []) {
    const p = (r.province as string) ?? "?";
    provCounts.set(p, (provCounts.get(p) ?? 0) + 1);
  }
  const byProvince = [...provCounts.entries()]
    .map(([province, count]) => ({ province, count }))
    .sort((a, b) => b.count - a.count);

  // Review status breakdown
  const statuses = ["pending", "auto_approved", "needs_review", "admin_approved", "admin_rejected", "discarded"];
  const statusCounts: { status: string; count: number }[] = [];
  for (const s of statuses) {
    const { count } = await db.from("sagre").select("id", { count: "exact", head: true }).eq("review_status", s);
    statusCounts.push({ status: s, count: count ?? 0 });
  }

  return {
    total_sagre: total.count ?? 0,
    active_sagre: active.count ?? 0,
    future_sagre: future.count ?? 0,
    expired_sagre: expired.count ?? 0,
    no_date_sagre: noDate.count ?? 0,
    no_province: noProv.count ?? 0,
    no_image: noImg.count ?? 0,
    by_source: bySource,
    by_review_status: statusCounts,
    by_province: byProvince,
  };
}

// ============================================================
// Source monitoring & management
// ============================================================

export type SourceOverview = {
  name: string;
  display_name: string;
  type: "web" | "api" | "instagram" | "facebook" | "search" | "enrichment";
  is_active: boolean;
  last_scraped_at: string | null;
  last_status: string | null;
  last_found: number | null;
  last_inserted: number | null;
  last_merged: number | null;
  last_error: string | null;
  last_duration_ms: number | null;
  sub_sources?: string[];
};

/** Get overview of ALL sources with last scrape stats */
export async function getSourcesOverview(): Promise<SourceOverview[]> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  // 1. Get DB-driven web scrapers
  const { data: webSources } = await db
    .from("scraper_sources")
    .select("name, display_name, is_active, last_scraped_at")
    .order("name");

  // 2. Get external sources (instagram, facebook)
  const { data: extSources } = await db
    .from("external_sources")
    .select("type, name, url, is_active, last_scraped_at, last_result");

  // 3. Get last scrape log per source_name
  const { data: logs } = await db
    .from("scrape_logs")
    .select("source_name, status, events_found, events_inserted, events_merged, error_message, duration_ms, completed_at")
    .order("completed_at", { ascending: false })
    .limit(200);

  // Build last-log-per-source map
  const lastLogMap = new Map<string, (typeof logs extends (infer T)[] | null ? T : never)>();
  for (const log of logs ?? []) {
    if (!lastLogMap.has(log.source_name)) {
      lastLogMap.set(log.source_name, log);
    }
  }

  const sources: SourceOverview[] = [];

  // Web scrapers from scraper_sources
  for (const s of webSources ?? []) {
    const log = lastLogMap.get(s.name);
    sources.push({
      name: s.name,
      display_name: s.display_name,
      type: "web",
      is_active: s.is_active,
      last_scraped_at: log?.completed_at ?? s.last_scraped_at,
      last_status: log?.status ?? null,
      last_found: log?.events_found ?? null,
      last_inserted: log?.events_inserted ?? null,
      last_merged: log?.events_merged ?? null,
      last_error: log?.error_message ?? null,
      last_duration_ms: log?.duration_ms ?? null,
    });
  }

  // Custom API scrapers (hardcoded edge functions)
  const customSources = [
    { name: "sagretoday", display_name: "SagreToday", type: "api" as const },
    { name: "trovasagre", display_name: "TrovaSagre", type: "api" as const },
    { name: "sagriamo", display_name: "Sagriamo", type: "api" as const },
    { name: "cheventi", display_name: "ChEventi", type: "api" as const },
  ];
  for (const s of customSources) {
    const log = lastLogMap.get(s.name);
    sources.push({
      name: s.name,
      display_name: s.display_name,
      type: s.type,
      is_active: true,
      last_scraped_at: log?.completed_at ?? null,
      last_status: log?.status ?? null,
      last_found: log?.events_found ?? null,
      last_inserted: log?.events_inserted ?? null,
      last_merged: log?.events_merged ?? null,
      last_error: log?.error_message ?? null,
      last_duration_ms: log?.duration_ms ?? null,
    });
  }

  // External sources: aggregate by type (show per-account in management, but here show per-type summary)
  const extByType = new Map<string, { type: string; count: number; active: number; names: string[] }>();
  for (const s of extSources ?? []) {
    const entry = extByType.get(s.type) ?? { type: s.type, count: 0, active: 0, names: [] as string[] };
    entry.count++;
    if (s.is_active) { entry.active++; entry.names.push(s.name); }
    extByType.set(s.type, entry);
  }

  // Facebook summary
  const fbLog = lastLogMap.get("facebook");
  const fbInfo = extByType.get("facebook");
  sources.push({
    name: "facebook",
    display_name: `Facebook (${fbInfo?.active ?? 0}/${fbInfo?.count ?? 0} pagine)`,
    type: "facebook",
    is_active: (fbInfo?.active ?? 0) > 0,
    last_scraped_at: fbLog?.completed_at ?? null,
    last_status: fbLog?.status ?? null,
    last_found: fbLog?.events_found ?? null,
    last_inserted: fbLog?.events_inserted ?? null,
    last_merged: fbLog?.events_merged ?? null,
    last_error: fbLog?.error_message ?? null,
    last_duration_ms: fbLog?.duration_ms ?? null,
    sub_sources: fbInfo?.names?.sort() ?? [],
  });

  // Instagram summary
  const igLog = lastLogMap.get("instagram");
  const igInfo = extByType.get("instagram");
  sources.push({
    name: "instagram",
    display_name: `Instagram (${igInfo?.active ?? 0}/${igInfo?.count ?? 0} profili)`,
    type: "instagram",
    is_active: (igInfo?.active ?? 0) > 0,
    last_scraped_at: igLog?.completed_at ?? null,
    last_status: igLog?.status ?? null,
    last_found: igLog?.events_found ?? null,
    last_inserted: igLog?.events_inserted ?? null,
    last_merged: igLog?.events_merged ?? null,
    last_error: igLog?.error_message ?? null,
    last_duration_ms: igLog?.duration_ms ?? null,
    sub_sources: igInfo?.names?.sort() ?? [],
  });

  // Tavily discovery
  const tavLog = lastLogMap.get("tavily");
  sources.push({
    name: "tavily",
    display_name: "Tavily Discovery",
    type: "search",
    is_active: true,
    last_scraped_at: tavLog?.completed_at ?? null,
    last_status: tavLog?.status ?? null,
    last_found: tavLog?.events_found ?? null,
    last_inserted: tavLog?.events_inserted ?? null,
    last_merged: tavLog?.events_merged ?? null,
    last_error: tavLog?.error_message ?? null,
    last_duration_ms: tavLog?.duration_ms ?? null,
  });

  return sources;
}

export type ExternalSource = {
  id: string;
  type: string;
  name: string;
  url: string;
  notes: string | null;
  is_active: boolean;
  last_scraped_at: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  last_result: any;
};

/** Get all external sources for management */
export async function getExternalSources(): Promise<ExternalSource[]> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const { data, error } = await db
    .from("external_sources")
    .select("*")
    .order("type")
    .order("name");

  if (error) {
    console.error("external_sources query error:", error.message);
    return [];
  }
  return (data ?? []) as ExternalSource[];
}

/** Add a new external source */
export async function addExternalSource(
  type: string,
  name: string,
  url: string,
  notes?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const { error } = await db.from("external_sources").insert({
    type,
    name,
    url: url.trim(),
    notes: notes || null,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "URL già presente" };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Toggle external source active/inactive */
export async function toggleExternalSource(id: string, isActive: boolean) {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const { error } = await db
    .from("external_sources")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/** Delete an external source */
export async function deleteExternalSource(id: string) {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = createAdminClient();

  const { error } = await db.from("external_sources").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// =============================================================================
// Provider usage / rate limit status
// =============================================================================

export type ProviderStatus = {
  name: string;
  status: "ok" | "low" | "exhausted" | "error";
  used: number | null;
  limit: number | null;
  unit: string;
  detail?: string;
};

/** Check rate limits for all LLM + image providers by making a minimal call and reading headers */
export async function getProviderStatus(): Promise<ProviderStatus[]> {
  if (!(await isAdmin())) throw new Error("Unauthorized");

  const results: ProviderStatus[] = [];

  // --- Groq ---
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "ok" }],
        max_tokens: 1,
      }),
    });
    const limitReq = parseInt(res.headers.get("x-ratelimit-limit-requests") ?? "0", 10);
    const remainReq = parseInt(res.headers.get("x-ratelimit-remaining-requests") ?? "0", 10);
    const used = limitReq - remainReq;
    results.push({
      name: "Groq (Llama 3.1 8B)",
      status: remainReq > 1000 ? "ok" : remainReq > 100 ? "low" : "exhausted",
      used,
      limit: limitReq,
      unit: "req/giorno",
    });
  } catch {
    results.push({ name: "Groq", status: "error", used: null, limit: null, unit: "req/giorno", detail: "Connessione fallita" });
  }

  // --- Mistral ---
  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MISTRAL_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: "ok" }],
        max_tokens: 1,
      }),
    });
    const limitTok = parseInt(res.headers.get("x-ratelimit-limit-tokens-month") ?? "0", 10);
    const remainTok = parseInt(res.headers.get("x-ratelimit-remaining-tokens-month") ?? "0", 10);
    const limitReq = parseInt(res.headers.get("x-ratelimit-limit-req-minute") ?? "0", 10);
    const remainReq = parseInt(res.headers.get("x-ratelimit-remaining-req-minute") ?? "0", 10);
    const usedTok = limitTok - remainTok;
    results.push({
      name: "Mistral (Small)",
      status: remainTok > 500_000 ? "ok" : remainTok > 100_000 ? "low" : "exhausted",
      used: usedTok,
      limit: limitTok,
      unit: "token/mese",
      detail: `${remainReq}/${limitReq} req/min`,
    });
  } catch {
    results.push({ name: "Mistral", status: "error", used: null, limit: null, unit: "token/mese", detail: "Connessione fallita" });
  }

  // --- Gemini (free tier — no headers, test with a call) ---
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "ok" }] }] }),
      }
    );
    if (res.ok) {
      results.push({ name: "Gemini (2.5 Flash)", status: "ok", used: null, limit: 20, unit: "req/giorno", detail: "Free tier" });
    } else {
      const body = await res.text();
      const isQuota = body.includes("429") || body.includes("quota");
      results.push({
        name: "Gemini (2.5 Flash)",
        status: isQuota ? "exhausted" : "error",
        used: isQuota ? 20 : null,
        limit: 20,
        unit: "req/giorno",
        detail: isQuota ? "Quota esaurita" : `HTTP ${res.status}`,
      });
    }
  } catch {
    results.push({ name: "Gemini", status: "error", used: null, limit: 20, unit: "req/giorno", detail: "Connessione fallita" });
  }

  // --- Unsplash ---
  try {
    const res = await fetch(
      "https://api.unsplash.com/search/photos?query=test&per_page=1",
      { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`, "Accept-Version": "v1" } }
    );
    const limit = parseInt(res.headers.get("X-Ratelimit-Limit") ?? "50", 10);
    const remain = parseInt(res.headers.get("X-Ratelimit-Remaining") ?? "0", 10);
    results.push({
      name: "Unsplash",
      status: remain > 10 ? "ok" : remain > 2 ? "low" : "exhausted",
      used: limit - remain,
      limit,
      unit: "req/ora",
    });
  } catch {
    results.push({ name: "Unsplash", status: "error", used: null, limit: 50, unit: "req/ora" });
  }

  // --- Pexels ---
  try {
    const res = await fetch(
      "https://api.pexels.com/v1/search?query=test&per_page=1",
      { headers: { Authorization: process.env.PEXELS_API_KEY ?? "" } }
    );
    const limit = parseInt(res.headers.get("X-Ratelimit-Limit") ?? "200", 10);
    const remain = parseInt(res.headers.get("X-Ratelimit-Remaining") ?? "0", 10);
    results.push({
      name: "Pexels",
      status: remain > 50 ? "ok" : remain > 10 ? "low" : "exhausted",
      used: limit - remain,
      limit,
      unit: "req/ora",
    });
  } catch {
    results.push({ name: "Pexels", status: "error", used: null, limit: 200, unit: "req/ora" });
  }

  // --- Pixabay ---
  try {
    const key = process.env.PIXABAY_API_KEY;
    if (!key) throw new Error("No key");
    const res = await fetch(`https://pixabay.com/api/?key=${key}&q=test&per_page=3`);
    const limit = parseInt(res.headers.get("X-RateLimit-Limit") ?? "100", 10);
    const remain = parseInt(res.headers.get("X-RateLimit-Remaining") ?? "0", 10);
    results.push({
      name: "Pixabay",
      status: remain > 20 ? "ok" : remain > 5 ? "low" : "exhausted",
      used: limit - remain,
      limit,
      unit: "req/min",
    });
  } catch {
    results.push({ name: "Pixabay", status: "error", used: null, limit: 100, unit: "req/min" });
  }

  return results;
}
