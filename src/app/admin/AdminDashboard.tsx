"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminSagre,
  getStatusCounts,
  getPipelineStats,
  triggerEnrichment,
  triggerEdgeFunction,
  approveAction,
  rejectAction,
  bulkApproveAutoAction,
  logoutAction,
  getEnrichLogs,
  getCronJobs,
  toggleCronJob,
  getDbDiagnostics,
  getSourcesOverview,
  getExternalSources,
  addExternalSource,
  toggleExternalSource,
  deleteExternalSource,
  type ReviewStatus,
  type SourceOverview,
  type ExternalSource,
  type CronJob,
  type DbDiagnostics,
} from "./actions";
import { EditModal } from "./EditModal";
import { Check, X, ExternalLink, LogOut, ChevronLeft, ChevronRight, RefreshCw, Play, Pause, Plus, Trash2, Power, LayoutDashboard, BarChart3, List } from "lucide-react";
import { FoodIcons } from "@/lib/constants/food-icons";

type SagraRow = Awaited<ReturnType<typeof getAdminSagre>>["data"][number];
type PipelineData = Awaited<ReturnType<typeof getPipelineStats>>;
type View = "dashboard" | "dettagli" | "sagre";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "In attesa", color: "bg-yellow-100 text-yellow-800" },
  auto_approved: { label: "Auto approvate", color: "bg-blue-100 text-blue-800" },
  needs_review: { label: "Da rivedere", color: "bg-orange-100 text-orange-800" },
  admin_approved: { label: "Approvate", color: "bg-green-100 text-green-800" },
  admin_rejected: { label: "Rifiutate", color: "bg-red-100 text-red-800" },
  discarded: { label: "Scartate", color: "bg-gray-100 text-gray-500" },
};

function getReason(row: SagraRow): string {
  // For discarded sagre, explain WHY they were discarded
  if (row.review_status === "discarded") {
    if (row.status === "classified_non_sagra") return "Non è una sagra";
    if (row.status === "duplicate") return "Duplicato";
    if (row.confidence != null && row.confidence < 30) return "Confidence troppo bassa (" + row.confidence + ")";
    if (!row.start_date) return "Senza data";
    // Discarded manually or by dedup cleanup
    return "Scartata manualmente";
  }

  // For pending/in-queue sagre, show pipeline stage
  if (row.status === "pending_geocode") return "In coda geocoding";
  if (row.status === "pending_llm" || row.status === "geocode_failed") return "In coda Gemini";
  if (row.confidence == null) return "In attesa di analisi";

  const parts: string[] = [];
  if (row.confidence < 30) parts.push("Confidence " + row.confidence);
  else if (row.confidence < 70) parts.push("Confidence " + row.confidence);
  else parts.push("OK (" + row.confidence + ")");
  if (!row.start_date) parts.push("Senza data");
  return parts.join(" · ");
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "adesso";
  if (mins < 60) return `${mins}m fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h fa`;
  return `${Math.floor(hrs / 24)}g fa`;
}

// =============================================================================
// Main component
// =============================================================================

export function AdminDashboard() {
  const router = useRouter();
  const [view, setView] = useState<View>("dashboard");

  // Shared state
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [prevPipeline, setPrevPipeline] = useState<PipelineData | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPending, startTransition] = useTransition();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [enrichLogs, setEnrichLogs] = useState<any[]>([]);
  const [sourcesOverview, setSourcesOverview] = useState<SourceOverview[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);

  // Sagre view state
  const [status, setStatus] = useState<ReviewStatus | "all">("needs_review");
  const [rows, setRows] = useState<SagraRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);

  // Dettagli view state
  const [diagnostics, setDiagnostics] = useState<DbDiagnostics | null>(null);
  const [extSources, setExtSources] = useState<ExternalSource[]>([]);
  const [showSourceMgmt, setShowSourceMgmt] = useState(false);
  const [newSource, setNewSource] = useState({ type: "instagram", name: "", url: "", notes: "" });
  const [sourceMsg, setSourceMsg] = useState<string | null>(null);
  const [triggerMsg, setTriggerMsg] = useState<Record<string, string>>({});

  // Load pipeline stats
  const loadPipeline = useCallback(() => {
    getPipelineStats().then((p) => {
      setPipeline((prev) => { if (prev) setPrevPipeline(prev); return p; });
      setLastUpdate(new Date());
    });
    getEnrichLogs(6).then(setEnrichLogs).catch(() => {});
    getSourcesOverview().then(setSourcesOverview).catch(() => {});
    getCronJobs().then(setCronJobs).catch(() => {});
  }, []);

  const loadTable = useCallback(() => {
    setLoading(true);
    Promise.all([getAdminSagre(status, page), getStatusCounts()])
      .then(([result, c]) => { setRows(result.data); setTotal(result.total); setCounts(c); })
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { loadPipeline(); loadTable(); }, [loadPipeline, loadTable]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(() => { loadPipeline(); getStatusCounts().then(setCounts); }, 10_000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, loadPipeline]);

  // Enrichment actions
  function handleTriggerEnrich() {
    startTransition(async () => {
      const msg = await triggerEnrichment();
      setEnrichMsg(msg === "started" ? "Avviato" : msg);
      setTimeout(() => setEnrichMsg(null), 5000);
    });
  }

  // Self-chaining removed: pg_cron now runs every 10 min (migration 026)

  function handleLogout() {
    startTransition(async () => { await logoutAction(); router.refresh(); });
  }

  // Derived state for dashboard
  const isWorking = enrichLogs.length > 0 && enrichLogs[0]?.completed_at &&
    (Date.now() - new Date(enrichLogs[0].completed_at).getTime()) < 180_000;
  const lastEnrichAgo = enrichLogs[0]?.completed_at ? timeAgo(enrichLogs[0].completed_at) : null;
  const pendingTotal = (pipeline?.pending_geocode ?? 0) + (pipeline?.pending_llm ?? 0);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <nav className="flex w-48 flex-col border-r bg-gray-50">
        <div className="border-b px-4 py-4">
          <h1 className="text-lg font-bold">Nemovia</h1>
          <p className="text-[10px] text-muted-foreground">Pannello Admin</p>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2">
          {([
            { id: "dashboard" as View, label: "Dashboard", icon: LayoutDashboard },
            { id: "dettagli" as View, label: "Dettagli", icon: BarChart3 },
            { id: "sagre" as View, label: "Gestione Sagre", icon: List },
          ]).map((item) => (
            <button
              key={item.id}
              onClick={() => { setView(item.id); if (item.id === "sagre") loadTable(); if (item.id === "dettagli") getDbDiagnostics().then(setDiagnostics).catch(() => {}); }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                view === item.id ? "bg-primary text-white" : "text-muted-foreground hover:bg-gray-200"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>
        <div className="border-t p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                autoRefresh ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
              }`}
            >
              {autoRefresh ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
              Live
              {autoRefresh && <span className="ml-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />}
            </button>
            <button onClick={handleLogout} className="text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
          {lastUpdate && (
            <p className="px-2 text-[9px] text-muted-foreground">
              {lastUpdate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-100/50 p-6">
        {view === "dashboard" && (
          <DashboardView
            pipeline={pipeline}
            isWorking={isWorking}
            lastEnrichAgo={lastEnrichAgo}
            pendingTotal={pendingTotal}
            enrichMsg={enrichMsg}
            isPending={isPending}
            enrichLogs={enrichLogs}
            sourcesOverview={sourcesOverview}
            counts={counts}
            onTriggerEnrich={handleTriggerEnrich}
          />
        )}
        {view === "dettagli" && (
          <DettagliView
            pipeline={pipeline}
            prevPipeline={prevPipeline}
            enrichLogs={enrichLogs}
            sourcesOverview={sourcesOverview}
            cronJobs={cronJobs}
            diagnostics={diagnostics}
            extSources={extSources}
            showSourceMgmt={showSourceMgmt}
            newSource={newSource}
            sourceMsg={sourceMsg}
            triggerMsg={triggerMsg}
            onSetShowSourceMgmt={(v) => { setShowSourceMgmt(v); if (v) getExternalSources().then(setExtSources); }}
            onSetNewSource={setNewSource}
            onAddSource={async () => {
              if (!newSource.name.trim() || !newSource.url.trim()) return;
              setSourceMsg(null);
              const res = await addExternalSource(newSource.type, newSource.name.trim(), newSource.url.trim(), newSource.notes.trim() || undefined);
              if (res.ok) {
                setNewSource({ type: newSource.type, name: "", url: "", notes: "" });
                setSourceMsg("Aggiunta!");
                getExternalSources().then(setExtSources);
                getSourcesOverview().then(setSourcesOverview);
              } else { setSourceMsg(res.error ?? "Errore"); }
            }}
            onToggleSource={async (id, active) => { await toggleExternalSource(id, active); getExternalSources().then(setExtSources); getSourcesOverview().then(setSourcesOverview); }}
            onDeleteSource={async (id) => { await deleteExternalSource(id); getExternalSources().then(setExtSources); getSourcesOverview().then(setSourcesOverview); }}
            onToggleCron={async (name, active) => { await toggleCronJob(name, active); getCronJobs().then(setCronJobs); }}
            onTriggerFn={async (fn) => {
              setTriggerMsg((p) => ({ ...p, [fn]: "..." }));
              const msg = await triggerEdgeFunction(fn);
              setTriggerMsg((p) => ({ ...p, [fn]: msg === "started" ? "avviato" : msg }));
              setTimeout(() => setTriggerMsg((p) => { const n = { ...p }; delete n[fn]; return n; }), 5000);
            }}
            onRefreshDiag={() => getDbDiagnostics().then(setDiagnostics)}
          />
        )}
        {view === "sagre" && (
          <SagreView
            rows={rows} total={total} page={page} counts={counts} status={status}
            loading={loading} isPending={isPending} editId={editId}
            onSetStatus={(s) => { setStatus(s); setPage(0); }}
            onSetPage={setPage}
            onApprove={(id) => startTransition(async () => { await approveAction(id); loadTable(); loadPipeline(); })}
            onReject={(id) => startTransition(async () => { await rejectAction(id); loadTable(); loadPipeline(); })}
            onBulkApprove={() => { if (!confirm("Approvare tutte le auto_approved?")) return; startTransition(async () => { await bulkApproveAutoAction(); loadTable(); loadPipeline(); }); }}
            onEdit={(id) => setEditId(id)}
            onCloseEdit={() => setEditId(null)}
            onSaved={() => { setEditId(null); loadTable(); loadPipeline(); }}
            onRefresh={loadTable}
          />
        )}
      </main>
    </div>
  );
}

// =============================================================================
// DASHBOARD VIEW — Overview chiaro
// =============================================================================

function DashboardView({
  pipeline, isWorking, lastEnrichAgo, pendingTotal, enrichMsg, isPending,
  enrichLogs, sourcesOverview, counts,
  onTriggerEnrich,
}: {
  pipeline: PipelineData | null;
  isWorking: boolean;
  lastEnrichAgo: string | null;
  pendingTotal: number;
  enrichMsg: string | null;
  isPending: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enrichLogs: any[];
  sourcesOverview: SourceOverview[];
  counts: Record<string, number>;
  onTriggerEnrich: () => void;
}) {
  if (!pipeline) return <div className="py-20 text-center text-muted-foreground">Caricamento...</div>;

  // Determine system status
  const hasErrors = enrichLogs.some((l) => l.error_message);
  const systemStatus = isWorking
    ? { label: "Pipeline in corso", color: "bg-blue-500", pulse: true }
    : pendingTotal > 0
      ? { label: "In coda — avvia enrichment", color: "bg-yellow-500", pulse: false }
      : pipeline.active > 0
        ? { label: "Tutto OK", color: "bg-green-500", pulse: false }
        : { label: "Nessuna sagra attiva", color: "bg-red-500", pulse: false };

  // Sources with errors
  const errorSources = sourcesOverview.filter((s) => s.last_status === "error");
  const recentSources = sourcesOverview.filter((s) => s.last_scraped_at).sort((a, b) =>
    new Date(b.last_scraped_at!).getTime() - new Date(a.last_scraped_at!).getTime()
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* System status banner */}
      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`h-4 w-4 rounded-full ${systemStatus.color} ${systemStatus.pulse ? "animate-pulse" : ""}`} />
            <div>
              <h2 className="text-xl font-bold">{systemStatus.label}</h2>
              <p className="text-sm text-muted-foreground">
                {lastEnrichAgo ? `Ultimo enrichment: ${lastEnrichAgo}` : "Nessun enrichment recente"}
                {enrichMsg && <span className="ml-2 text-blue-600">{enrichMsg}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onTriggerEnrich} disabled={isPending} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className={`mr-1 inline h-4 w-4 ${isPending ? "animate-spin" : ""}`} /> Run Manuale
            </button>
            <span className="text-xs text-muted-foreground">Cron: ogni 10 min</span>
          </div>
        </div>
      </div>

      {/* Key metrics — 4 big numbers */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Attive sul sito" value={pipeline.active} color="text-green-600" big />
        <MetricCard label="In coda" value={pendingTotal} color={pendingTotal > 0 ? "text-orange-500" : "text-gray-400"} big />
        <MetricCard label="Con immagine" value={pipeline.with_image} color="text-purple-600" big />
        <MetricCard label="Totali nel DB" value={pipeline.total} big />
      </div>

      {/* Progress bar */}
      {pipeline.total > 0 && (
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium">Progresso analisi</span>
            <span className="text-muted-foreground">
              {pipeline.total - pendingTotal} / {pipeline.total} ({Math.round(((pipeline.total - pendingTotal) / pipeline.total) * 100)}%)
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-primary transition-all duration-1000"
              style={{ width: `${((pipeline.total - pendingTotal) / pipeline.total) * 100}%` }} />
          </div>
          {pendingTotal > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {pipeline.pending_geocode} da geocodificare + {pipeline.pending_llm} da analizzare (Gemini)
            </p>
          )}
        </div>
      )}

      {/* Two columns: review status + recent scraper activity */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Review status summary */}
        <div className="rounded-xl bg-white p-4 shadow">
          <h3 className="mb-3 text-sm font-bold">Stato Review</h3>
          <div className="space-y-2">
            {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
              <div key={key} className="flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>
                <span className="font-mono text-sm font-bold">{counts[key] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent scraper activity */}
        <div className="rounded-xl bg-white p-4 shadow">
          <h3 className="mb-3 text-sm font-bold">Ultima attivit&agrave; fonti</h3>
          <div className="space-y-1.5 text-xs">
            {recentSources.slice(0, 8).map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <span className="font-medium">{s.display_name}</span>
                <div className="flex items-center gap-2">
                  {s.last_inserted != null && s.last_inserted > 0 && (
                    <span className="text-green-600">+{s.last_inserted}</span>
                  )}
                  <span className="text-muted-foreground">{s.last_scraped_at ? timeAgo(s.last_scraped_at) : "mai"}</span>
                </div>
              </div>
            ))}
          </div>
          {errorSources.length > 0 && (
            <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-600">
              {errorSources.length} fonte/i con errori: {errorSources.map((s) => s.display_name).join(", ")}
            </div>
          )}
        </div>
      </div>

      {/* Last enrichment runs — compact */}
      {enrichLogs.length > 0 && (
        <div className="rounded-xl bg-white p-4 shadow">
          <h3 className="mb-2 text-sm font-bold">Ultimi run enrichment</h3>
          <div className="overflow-x-auto text-xs">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-[10px] text-muted-foreground">
                  <th className="pb-1 pr-3">Quando</th>
                  <th className="pb-1 pr-3 text-right">Durata</th>
                  <th className="pb-1 pr-3 text-right">Geocod</th>
                  <th className="pb-1 pr-3 text-right">LLM</th>
                  <th className="pb-1 pr-3 text-right">Scartate</th>
                  <th className="pb-1">Errore</th>
                </tr>
              </thead>
              <tbody>
                {enrichLogs.map((log, i) => (
                  <tr key={i} className={log.error_message ? "text-red-500" : ""}>
                    <td className="py-1 pr-3">{log.completed_at ? timeAgo(log.completed_at) : "—"}</td>
                    <td className="py-1 pr-3 text-right font-mono">{log.duration_ms ? `${(log.duration_ms / 1000).toFixed(0)}s` : "—"}</td>
                    <td className="py-1 pr-3 text-right font-mono text-cyan-600">{log.geocoded_count ?? 0}</td>
                    <td className="py-1 pr-3 text-right font-mono text-green-600">{log.llm_count ?? 0}</td>
                    <td className="py-1 pr-3 text-right font-mono text-red-400">{log.skipped_count ?? 0}</td>
                    <td className="max-w-[200px] truncate py-1 text-red-500">{log.error_message ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color, big }: { label: string; value: number; color?: string; big?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow text-center">
      <div className={`${big ? "text-3xl" : "text-xl"} font-bold ${color ?? "text-foreground"}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// =============================================================================
// DETTAGLI VIEW — Monitoring avanzato
// =============================================================================

function DettagliView({
  pipeline, prevPipeline, enrichLogs, sourcesOverview, cronJobs, diagnostics,
  extSources, showSourceMgmt, newSource, sourceMsg, triggerMsg,
  onSetShowSourceMgmt, onSetNewSource, onAddSource, onToggleSource, onDeleteSource,
  onToggleCron, onTriggerFn, onRefreshDiag,
}: {
  pipeline: PipelineData | null;
  prevPipeline: PipelineData | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enrichLogs: any[];
  sourcesOverview: SourceOverview[];
  cronJobs: CronJob[];
  diagnostics: DbDiagnostics | null;
  extSources: ExternalSource[];
  showSourceMgmt: boolean;
  newSource: { type: string; name: string; url: string; notes: string };
  sourceMsg: string | null;
  triggerMsg: Record<string, string>;
  onSetShowSourceMgmt: (v: boolean) => void;
  onSetNewSource: (v: { type: string; name: string; url: string; notes: string }) => void;
  onAddSource: () => void;
  onToggleSource: (id: string, active: boolean) => void;
  onDeleteSource: (id: string) => void;
  onToggleCron: (name: string, active: boolean) => void;
  onTriggerFn: (fn: string) => void;
  onRefreshDiag: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h2 className="text-xl font-bold">Dettagli Pipeline</h2>

      {/* Pipeline stats grid */}
      {pipeline && (
        <div className="rounded-xl bg-white p-4 shadow">
          <h3 className="mb-3 text-sm font-bold">Pipeline Enrichment</h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <PipelineStat label="Totali" value={pipeline.total} />
            <PipelineStat label="Da geocodificare" value={pipeline.pending_geocode} color={pipeline.pending_geocode > 0 ? "text-yellow-600" : undefined} prev={prevPipeline?.pending_geocode} />
            <PipelineStat label="Da analizzare" value={pipeline.pending_llm} color={pipeline.pending_llm > 0 ? "text-orange-600" : undefined} prev={prevPipeline?.pending_llm} />
            <PipelineStat label="Analizzate" value={pipeline.enriched} color="text-blue-600" prev={prevPipeline?.enriched} />
            <PipelineStat label="Con immagine" value={pipeline.with_image} color="text-purple-600" prev={prevPipeline?.with_image} />
            <PipelineStat label="Attive" value={pipeline.active} color="text-green-600" prev={prevPipeline?.active} />
          </div>
        </div>
      )}

      {/* Stato Fonti */}
      <div className="rounded-xl bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Stato Fonti ({sourcesOverview.length})</h3>
          <button onClick={() => onSetShowSourceMgmt(!showSourceMgmt)}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/5">
            <Plus className="h-3 w-3" /> Gestisci Fonti
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b text-left text-[10px] text-muted-foreground">
                <th className="pb-1.5 pr-3">Fonte</th>
                <th className="pb-1.5 pr-3">Tipo</th>
                <th className="pb-1.5 pr-3">Stato</th>
                <th className="pb-1.5 pr-3">Ultimo</th>
                <th className="pb-1.5 pr-2 text-right">Trovate</th>
                <th className="pb-1.5 pr-2 text-right">Inserite</th>
                <th className="pb-1.5 pr-2 text-right">Merged</th>
                <th className="pb-1.5 pr-2 text-right">Durata</th>
                <th className="pb-1.5">Errore</th>
              </tr>
            </thead>
            <tbody>
              {sourcesOverview.map((s) => (
                <tr key={s.name} className={`border-b last:border-0 ${s.last_status === "error" ? "bg-red-50" : ""}`}>
                  <td className="py-1.5 pr-3 font-medium">{s.display_name}</td>
                  <td className="py-1.5 pr-3">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                      s.type === "web" ? "bg-blue-100 text-blue-700" : s.type === "api" ? "bg-purple-100 text-purple-700" :
                      s.type === "instagram" ? "bg-pink-100 text-pink-700" : s.type === "facebook" ? "bg-indigo-100 text-indigo-700" :
                      s.type === "search" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                    }`}>{s.type}</span>
                  </td>
                  <td className="py-1.5 pr-3">{s.is_active ? <span className="text-green-600">Attivo</span> : <span className="text-gray-400">Off</span>}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{s.last_scraped_at ? timeAgo(s.last_scraped_at) : "Mai"}</td>
                  <td className="py-1.5 pr-2 text-right font-mono">{s.last_found ?? "—"}</td>
                  <td className="py-1.5 pr-2 text-right font-mono text-green-600">{s.last_inserted ?? "—"}</td>
                  <td className="py-1.5 pr-2 text-right font-mono text-blue-600">{s.last_merged ?? "—"}</td>
                  <td className="py-1.5 pr-2 text-right font-mono">{s.last_duration_ms ? `${(s.last_duration_ms / 1000).toFixed(0)}s` : "—"}</td>
                  <td className="max-w-[180px] truncate py-1.5 text-red-500">{s.last_error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Source management */}
      {showSourceMgmt && (
        <div className="rounded-xl bg-white p-4 shadow">
          <h3 className="mb-3 text-sm font-bold">Gestione Fonti Esterne</h3>
          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg bg-muted/30 p-3">
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Tipo</label>
              <select value={newSource.type} onChange={(e) => onSetNewSource({ ...newSource, type: e.target.value })} className="rounded border px-2 py-1.5 text-xs">
                <option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="rss">RSS</option><option value="other">Altro</option>
              </select>
            </div>
            <div className="min-w-[150px] flex-1">
              <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Nome</label>
              <input value={newSource.name} onChange={(e) => onSetNewSource({ ...newSource, name: e.target.value })} placeholder="Pro Loco Treviso" className="w-full rounded border px-2 py-1.5 text-xs" />
            </div>
            <div className="min-w-[200px] flex-[2]">
              <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">URL</label>
              <input value={newSource.url} onChange={(e) => onSetNewSource({ ...newSource, url: e.target.value })} placeholder="https://www.instagram.com/..." className="w-full rounded border px-2 py-1.5 text-xs" />
            </div>
            <button onClick={onAddSource} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90">
              <Plus className="mr-0.5 inline h-3.5 w-3.5" /> Aggiungi
            </button>
            {sourceMsg && <span className="text-xs text-muted-foreground">{sourceMsg}</span>}
          </div>
          {extSources.length > 0 && (
            <table className="w-full text-[11px]">
              <thead><tr className="border-b text-left text-[10px] text-muted-foreground">
                <th className="pb-1.5 pr-3">Tipo</th><th className="pb-1.5 pr-3">Nome</th><th className="pb-1.5 pr-3">URL</th><th className="pb-1.5 pr-3">Stato</th><th className="pb-1.5">Azioni</th>
              </tr></thead>
              <tbody>
                {extSources.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3"><span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${s.type === "instagram" ? "bg-pink-100 text-pink-700" : s.type === "facebook" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>{s.type}</span></td>
                    <td className="py-1.5 pr-3 font-medium">{s.name}</td>
                    <td className="max-w-[250px] truncate py-1.5 pr-3"><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{s.url}</a></td>
                    <td className="py-1.5 pr-3">{s.is_active ? <span className="text-green-600">On</span> : <span className="text-gray-400">Off</span>}</td>
                    <td className="py-1.5"><div className="flex gap-1">
                      <button onClick={() => onToggleSource(s.id, !s.is_active)} className={`rounded p-1 ${s.is_active ? "text-orange-500" : "text-green-600"}`}><Power className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (confirm(`Eliminare "${s.name}"?`)) onDeleteSource(s.id); }} className="rounded p-1 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Cron jobs */}
      {cronJobs.length > 0 && (
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">Cron Jobs</h3>
            <button onClick={onRefreshDiag} className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/5">Diagnostica DB</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead><tr className="border-b text-left text-[10px] text-muted-foreground">
                <th className="pb-1.5 pr-3">Job</th><th className="pb-1.5 pr-3">Schedule</th><th className="pb-1.5 pr-3">Stato</th>
                <th className="pb-1.5 pr-3">Ultimo run</th><th className="pb-1.5 pr-3">Risultato</th><th className="pb-1.5">Azioni</th>
              </tr></thead>
              <tbody>
                {cronJobs.map((job) => {
                  const fn = job.jobname.replace(/-morning|-evening|-midday|-midnight/g, "");
                  return (
                    <tr key={job.jobname} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 font-mono text-[10px]">{job.jobname}</td>
                      <td className="py-1.5 pr-3 font-mono text-[10px] text-muted-foreground">{job.schedule}</td>
                      <td className="py-1.5 pr-3">{job.active ? <span className="text-green-600">On</span> : <span className="text-gray-400">Off</span>}</td>
                      <td className="py-1.5 pr-3">{job.last_run ? timeAgo(job.last_run) : "Mai"}</td>
                      <td className="py-1.5 pr-3"><span className={`text-[10px] ${job.last_status === "succeeded" ? "text-green-600" : "text-red-500"}`}>{job.last_status ?? "—"}</span></td>
                      <td className="py-1.5"><div className="flex gap-1">
                        <button onClick={() => onToggleCron(job.jobname, !job.active)} className={`rounded p-1 ${job.active ? "text-orange-500" : "text-green-600"}`}><Power className="h-3 w-3" /></button>
                        <button onClick={() => onTriggerFn(fn)} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20">{triggerMsg[fn] ?? "Run"}</button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DB Diagnostics */}
      {diagnostics && (
        <div className="rounded-xl bg-white p-4 shadow">
          <h3 className="mb-3 text-sm font-bold">Diagnostica Database</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <DiagStat label="Totali" value={diagnostics.total_sagre} />
            <DiagStat label="Attive" value={diagnostics.active_sagre} color="text-green-600" />
            <DiagStat label="Data futura" value={diagnostics.future_sagre} color="text-blue-600" />
            <DiagStat label="Scadute" value={diagnostics.expired_sagre} color="text-red-500" />
            <DiagStat label="Senza data" value={diagnostics.no_date_sagre} color="text-yellow-600" />
            <DiagStat label="Senza provincia" value={diagnostics.no_province} color="text-orange-500" />
            <DiagStat label="Senza img" value={diagnostics.no_image} color="text-purple-600" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div><h4 className="mb-1 text-[11px] font-bold text-muted-foreground">Per Fonte</h4>
              <div className="space-y-0.5 text-[11px]">{diagnostics.by_source.slice(0, 12).map((s) => (
                <div key={s.source} className="flex justify-between"><span className="truncate pr-2">{s.source}</span><span className="font-mono font-bold">{s.count}</span></div>
              ))}</div>
            </div>
            <div><h4 className="mb-1 text-[11px] font-bold text-muted-foreground">Per Review Status</h4>
              <div className="space-y-0.5 text-[11px]">{diagnostics.by_review_status.map((s) => (
                <div key={s.status} className="flex justify-between"><span>{STATUS_LABELS[s.status]?.label ?? s.status}</span><span className="font-mono font-bold">{s.count}</span></div>
              ))}</div>
            </div>
            <div><h4 className="mb-1 text-[11px] font-bold text-muted-foreground">Attive per Provincia</h4>
              <div className="space-y-0.5 text-[11px]">{diagnostics.by_province.length > 0 ? diagnostics.by_province.map((p) => (
                <div key={p.province} className="flex justify-between"><span>{p.province}</span><span className="font-mono font-bold">{p.count}</span></div>
              )) : <span className="text-muted-foreground">Nessuna</span>}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SAGRE VIEW — Gestione sagre
// =============================================================================

function SagreView({
  rows, total, page, counts, status, loading, isPending, editId,
  onSetStatus, onSetPage, onApprove, onReject, onBulkApprove, onEdit, onCloseEdit, onSaved, onRefresh,
}: {
  rows: SagraRow[]; total: number; page: number; counts: Record<string, number>;
  status: ReviewStatus | "all"; loading: boolean; isPending: boolean; editId: string | null;
  onSetStatus: (s: ReviewStatus | "all") => void;
  onSetPage: (p: number | ((p: number) => number)) => void;
  onApprove: (id: string) => void; onReject: (id: string) => void; onBulkApprove: () => void;
  onEdit: (id: string) => void; onCloseEdit: () => void; onSaved: () => void; onRefresh: () => void;
}) {
  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);

  // Load on status change
  useEffect(() => { onRefresh(); }, [status, page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <h2 className="text-xl font-bold">Gestione Sagre</h2>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["needs_review", "pending", "auto_approved", "admin_approved", "admin_rejected", "discarded", "all"] as const).map((s) => (
          <button key={s} onClick={() => onSetStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              status === s ? "bg-primary text-white" : "bg-white text-muted-foreground hover:bg-muted shadow-sm"
            }`}>
            {s === "all" ? "Tutte" : STATUS_LABELS[s]?.label ?? s}
            {s !== "all" && counts[s] != null && <span className="ml-1 opacity-70">({counts[s]})</span>}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {status === "auto_approved" && (counts.auto_approved ?? 0) > 0 && (
        <button onClick={onBulkApprove} disabled={isPending}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
          Approva tutte le auto_approved ({counts.auto_approved})
        </button>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground">Caricamento...</div>
      ) : rows.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">Nessuna sagra con questo filtro</div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Titolo</th><th className="px-3 py-2">Luogo</th><th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Conf.</th><th className="px-3 py-2">Stato</th><th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2">Fonte</th><th className="px-3 py-2">Tags</th><th className="px-3 py-2">Img</th><th className="px-3 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="max-w-[200px] truncate px-3 py-2 font-medium">{row.title}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="capitalize">{row.location_text?.toLowerCase()}</span>
                    {row.province && <span className="ml-1 text-muted-foreground">({row.province})</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {row.start_date ?? "—"}{row.end_date && row.end_date !== row.start_date && <span className="text-muted-foreground"> → {row.end_date}</span>}
                  </td>
                  <td className="px-3 py-2">{row.confidence != null ? (
                    <span className={`font-mono text-xs font-bold ${row.confidence >= 70 ? "text-green-600" : row.confidence >= 40 ? "text-yellow-600" : "text-red-500"}`}>{row.confidence}</span>
                  ) : "—"}</td>
                  <td className="px-3 py-2"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_LABELS[row.review_status ?? ""]?.color ?? "bg-gray-100 text-gray-500"}`}>
                    {STATUS_LABELS[row.review_status ?? ""]?.label ?? row.review_status}
                  </span></td>
                  <td className="max-w-[200px] px-3 py-2 text-[11px] text-muted-foreground">{getReason(row)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-muted-foreground">{row.source_id ? row.source_id.replace(/^scrape-/, "").replace(/-/g, " ") : "—"}</td>
                  <td className="px-3 py-2"><FoodIcons foodTags={row.food_tags} title={row.title} className="h-4 w-4" themed /></td>
                  <td className="px-3 py-2">
                    {row.image_url ? (
                      <ImagePreview src={row.image_url} />
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-1">
                      {row.review_status !== "admin_approved" && (
                        <button onClick={() => onApprove(row.id)} disabled={isPending} title="Approva" className="rounded p-1 text-green-600 hover:bg-green-50 disabled:opacity-50"><Check className="h-4 w-4" /></button>
                      )}
                      {row.review_status !== "admin_rejected" && row.review_status !== "discarded" && (
                        <button onClick={() => onReject(row.id)} disabled={isPending} title="Rifiuta" className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"><X className="h-4 w-4" /></button>
                      )}
                      <button onClick={() => onEdit(row.id)} title="Modifica" className="rounded p-1 text-blue-600 hover:bg-blue-50">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {row.source_url && (
                        <a href={row.source_url} target="_blank" rel="noopener noreferrer" title="Fonte" className="rounded p-1 text-muted-foreground hover:bg-muted"><ExternalLink className="h-4 w-4" /></a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{total} sagre</span>
          <div className="flex items-center gap-2">
            <button onClick={() => onSetPage((p: number) => Math.max(0, p - 1))} disabled={page === 0} className="rounded p-1 hover:bg-muted disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
            <span className="text-sm">{page + 1} / {totalPages}</span>
            <button onClick={() => onSetPage((p: number) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded p-1 hover:bg-muted disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editId && <EditModal sagraId={editId} onClose={onCloseEdit} onSaved={onSaved} />}
    </div>
  );
}

// =============================================================================
// Helper components
// =============================================================================

function ImagePreview({ src }: { src: string }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLImageElement>(null);

  function handleEnter() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
    setShow(true);
  }

  return (
    <>
      <img ref={ref} src={src} alt="" className="h-8 w-12 rounded object-cover cursor-pointer"
        onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}
        onError={(e) => { e.currentTarget.style.display = "none"; }} />
      {show && (
        <div className="pointer-events-none fixed z-[9999]"
          style={{ left: pos.x, top: pos.y - 8, transform: "translate(-50%, -100%)" }}>
          <img src={src} alt="" className="h-48 w-72 rounded-lg border bg-white object-cover shadow-2xl" />
        </div>
      )}
    </>
  );
}

function PipelineStat({ label, value, color, prev }: { label: string; value: number; color?: string; prev?: number }) {
  const diff = prev != null ? value - prev : 0;
  return (
    <div className="rounded-lg bg-muted/50 p-2 text-center">
      <div className={`text-lg font-bold ${color ?? "text-foreground"}`}>
        {value}
        {diff !== 0 && <span className={`ml-1 text-xs font-normal ${diff > 0 ? "text-green-500" : "text-red-400"}`}>{diff > 0 ? "+" : ""}{diff}</span>}
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function DiagStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2 text-center">
      <div className={`text-lg font-bold ${color ?? "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
