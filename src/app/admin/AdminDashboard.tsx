"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminSagre,
  getStatusCounts,
  getPipelineStats,
  triggerEnrichment,
  approveAction,
  rejectAction,
  bulkApproveAutoAction,
  logoutAction,
  getEnrichLogs,
  getSourcesOverview,
  getExternalSources,
  addExternalSource,
  toggleExternalSource,
  deleteExternalSource,
  type ReviewStatus,
  type SourceOverview,
  type ExternalSource,
} from "./actions";
import { EditModal } from "./EditModal";
import { Check, X, ExternalLink, LogOut, ChevronLeft, ChevronRight, RefreshCw, Play, Pause, Plus, Trash2, Power } from "lucide-react";
import { FoodIcons } from "@/lib/constants/food-icons";

type SagraRow = Awaited<ReturnType<typeof getAdminSagre>>["data"][number];
type PipelineData = Awaited<ReturnType<typeof getPipelineStats>>;

/** Derive a human-readable reason for the review status */
function getReason(row: SagraRow): string {
  const parts: string[] = [];

  // Pipeline stage
  if (row.status === "pending_geocode") parts.push("In coda geocoding");
  else if (row.status === "pending_llm" || row.status === "geocode_failed") parts.push("In coda Gemini");
  else if (row.status === "duplicate") parts.push("Duplicato");
  else if (row.confidence == null) parts.push("In attesa di analisi");
  else {
    // Has been analyzed by Gemini
    if (row.status === "classified_non_sagra") parts.push("Non è una sagra");
    if (row.confidence < 30) parts.push("Confidence troppo bassa (" + row.confidence + ")");
    else if (row.confidence < 70) parts.push("Confidence media (" + row.confidence + ")");
    else parts.push("Confidence alta (" + row.confidence + ")");
    if (!row.start_date) parts.push("Senza data");
    if (row.confidence >= 70 && row.start_date) parts.push("OK");
  }
  return parts.join(" · ") || "—";
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "In attesa", color: "bg-yellow-100 text-yellow-800" },
  auto_approved: { label: "Auto approvate", color: "bg-blue-100 text-blue-800" },
  needs_review: { label: "Da rivedere", color: "bg-orange-100 text-orange-800" },
  admin_approved: { label: "Approvate", color: "bg-green-100 text-green-800" },
  admin_rejected: { label: "Rifiutate", color: "bg-red-100 text-red-800" },
  discarded: { label: "Scartate", color: "bg-gray-100 text-gray-500" },
};

export function AdminDashboard() {
  const router = useRouter();
  const [status, setStatus] = useState<ReviewStatus | "all">("needs_review");
  const [rows, setRows] = useState<SagraRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [prevPipeline, setPrevPipeline] = useState<PipelineData | null>(null);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [enrichLogs, setEnrichLogs] = useState<any[]>([]);
  const [sourcesOverview, setSourcesOverview] = useState<SourceOverview[]>([]);
  const [extSources, setExtSources] = useState<ExternalSource[]>([]);
  const [showSourceMgmt, setShowSourceMgmt] = useState(false);
  const [newSource, setNewSource] = useState({ type: "instagram", name: "", url: "", notes: "" });
  const [sourceMsg, setSourceMsg] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loopRunning, setLoopRunning] = useState(false);
  const [loopRun, setLoopRun] = useState(0);
  const loopAbortRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setActivityLog((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 20));
  }, []);

  // Load table data (only on filter/page change)
  const loadTable = useCallback(() => {
    setLoading(true);
    Promise.all([getAdminSagre(status, page), getStatusCounts()])
      .then(([result, c]) => {
        setRows(result.data);
        setTotal(result.total);
        setCounts(c);
      })
      .finally(() => setLoading(false));
  }, [status, page]);

  // Load pipeline stats (lightweight, called frequently)
  const loadPipeline = useCallback(() => {
    getPipelineStats().then((p) => {
      setPipeline((prev) => {
        if (prev) {
          setPrevPipeline(prev);
          const diffs: string[] = [];
          if (p.pending_llm < prev.pending_llm) diffs.push(`Gemini: ${prev.pending_llm - p.pending_llm} analizzate`);
          if (p.enriched > prev.enriched) diffs.push(`+${p.enriched - prev.enriched} enriched`);
          if (p.active > prev.active) diffs.push(`+${p.active - prev.active} attive`);
          if (p.with_image > prev.with_image) diffs.push(`+${p.with_image - prev.with_image} immagini`);
          if (p.pending_geocode < prev.pending_geocode) diffs.push(`${prev.pending_geocode - p.pending_geocode} geocodificate`);
          if (diffs.length > 0) addLog(diffs.join(", "));
        }
        return p;
      });
      setLastUpdate(new Date());
    });
    getEnrichLogs(5).then(setEnrichLogs).catch(() => {});
    getSourcesOverview().then(setSourcesOverview).catch(() => {});
  }, [addLog]);

  // Initial load
  useEffect(() => { loadTable(); loadPipeline(); }, [loadTable, loadPipeline]);

  // Auto-refresh pipeline stats every 10s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadPipeline();
        // Also refresh table counts
        getStatusCounts().then(setCounts);
      }, 10_000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, loadPipeline]);

  function handleApprove(id: string) {
    startTransition(async () => {
      await approveAction(id);
      loadTable();
      loadPipeline();
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      await rejectAction(id);
      loadTable();
      loadPipeline();
    });
  }

  function handleBulkApprove() {
    if (!confirm("Approvare tutte le sagre auto_approved?")) return;
    startTransition(async () => {
      const count = await bulkApproveAutoAction();
      addLog(`Bulk approve: ${count} sagre approvate`);
      loadTable();
      loadPipeline();
    });
  }

  // Single run
  function handleTriggerEnrich() {
    setEnrichMsg(null);
    addLog("Avvio enrichment...");
    startTransition(async () => {
      const msg = await triggerEnrichment();
      if (msg === "started") {
        setEnrichMsg("Enrichment in corso...");
        addLog("Enrichment avviato! I numeri si aggiorneranno automaticamente.");
      } else {
        setEnrichMsg(msg);
        addLog(`Enrichment: ${msg}`);
      }
    });
  }

  // Loop mode: trigger with loop=true, server self-chains — no browser needed
  async function startEnrichLoop() {
    setLoopRunning(true);
    setLoopRun(1);
    addLog("--- Avvio loop server-side (continua anche a browser chiuso) ---");
    setEnrichMsg("Loop avviato — la funzione si auto-richiama finché c'è lavoro");

    const msg = await triggerEnrichment(true); // loop=true
    if (msg !== "started") {
      addLog(`Errore avvio: ${msg}`);
      setLoopRunning(false);
      setEnrichMsg(null);
      return;
    }
    addLog("Primo run avviato. Il server continuerà automaticamente.");
  }

  function stopEnrichLoop() {
    // Note: can't truly stop server-side loop from client, but we stop UI tracking
    setLoopRunning(false);
    setLoopRun(0);
    setEnrichMsg(null);
    addLog("Monitoraggio loop fermato (il run corrente completerà sul server).");
  }

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      router.refresh();
    });
  }

  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);
  const isProcessing = pipeline && prevPipeline && pipeline.pending_llm < prevPipeline.pending_llm;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Nemovia</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              autoRefresh ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
            title={autoRefresh ? "Auto-refresh attivo (ogni 10s)" : "Auto-refresh disattivato"}
          >
            {autoRefresh ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            Live
            {autoRefresh && <span className="ml-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />}
          </button>
          {lastUpdate && (
            <span className="text-[10px] text-muted-foreground">
              Aggiornato: {lastUpdate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" /> Esci
          </button>
        </div>
      </div>

      {/* Pipeline stats */}
      {pipeline && (
        <div className="mb-6 rounded-xl bg-white p-4 shadow">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold">Pipeline Enrichment</h2>
              {isProcessing && (
                <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  In elaborazione...
                </span>
              )}
              {enrichMsg && (
                <span className="text-xs text-green-600">{enrichMsg}</span>
              )}
            </div>
            {loopRunning ? (
              <button
                onClick={stopEnrichLoop}
                className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                <Pause className="h-3.5 w-3.5" />
                Ferma (Run #{loopRun})
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerEnrich}
                  disabled={isPending}
                  className="flex items-center gap-1 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                  1 Run
                </button>
                <button
                  onClick={() => startEnrichLoop()}
                  disabled={isPending}
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" />
                  Processa Tutto
                </button>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {pipeline.total > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Progresso analisi Gemini</span>
                <span>{pipeline.total - pipeline.pending_geocode - pipeline.pending_llm} / {pipeline.total} ({Math.round(((pipeline.total - pipeline.pending_geocode - pipeline.pending_llm) / pipeline.total) * 100)}%)</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-1000"
                  style={{ width: `${((pipeline.total - pipeline.pending_geocode - pipeline.pending_llm) / pipeline.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <PipelineStat label="Totali" value={pipeline.total} />
            <PipelineStat label="Da geocodificare" value={pipeline.pending_geocode} color={pipeline.pending_geocode > 0 ? "text-yellow-600" : undefined} prev={prevPipeline?.pending_geocode} />
            <PipelineStat label="Da analizzare (Gemini)" value={pipeline.pending_llm} color={pipeline.pending_llm > 0 ? "text-orange-600" : undefined} prev={prevPipeline?.pending_llm} />
            <PipelineStat label="Analizzate" value={pipeline.enriched} color="text-blue-600" prev={prevPipeline?.enriched} />
            <PipelineStat label="Con immagine" value={pipeline.with_image} color="text-purple-600" prev={prevPipeline?.with_image} />
            <PipelineStat label="Attive sul sito" value={pipeline.active} color="text-green-600" prev={prevPipeline?.active} />
          </div>

          {pipeline.pending_llm > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              ~{Math.ceil(pipeline.pending_llm / 200)} run necessari · {Math.ceil(pipeline.pending_llm / 200 / 2)} giorni con pg_cron 2x/day · clicca &quot;Avvia Enrichment&quot; per velocizzare
            </p>
          )}
        </div>
      )}

      {/* Activity log */}
      {activityLog.length > 0 && (
        <div className="mb-4 rounded-xl bg-gray-900 p-3 shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-gray-400">Activity Log</h3>
            <button onClick={() => setActivityLog([])} className="text-[10px] text-gray-500 hover:text-gray-300">Pulisci</button>
          </div>
          <div className="mt-1 max-h-24 overflow-y-auto font-mono text-[11px] text-green-400">
            {activityLog.map((line, i) => (
              <div key={i} className={i === 0 ? "font-semibold" : "text-green-400/70"}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Enrich run logs */}
      {enrichLogs.length > 0 && (
        <div className="mb-4 rounded-xl bg-gray-900 p-3 shadow">
          <h3 className="text-[11px] font-bold text-gray-400 mb-1">Ultimi Run Enrichment</h3>
          <div className="overflow-x-auto font-mono text-[10px] text-gray-300">
            <table className="w-full">
              <thead>
                <tr className="text-gray-500">
                  <th className="pr-3 text-left">Completato</th>
                  <th className="pr-3 text-right">Durata</th>
                  <th className="pr-3 text-right">Geocod</th>
                  <th className="pr-3 text-right">Geo fail</th>
                  <th className="pr-3 text-right">LLM</th>
                  <th className="pr-3 text-right">Scartate</th>
                  <th className="text-left">Errore</th>
                </tr>
              </thead>
              <tbody>
                {enrichLogs.map((log, i) => (
                  <tr key={i} className={log.error_message ? "text-red-400" : ""}>
                    <td className="pr-3">{log.completed_at ? new Date(log.completed_at).toLocaleTimeString("it-IT") : "—"}</td>
                    <td className="pr-3 text-right">{log.duration_ms ? `${(log.duration_ms / 1000).toFixed(0)}s` : "—"}</td>
                    <td className="pr-3 text-right text-cyan-400">{log.geocoded_count ?? 0}</td>
                    <td className="pr-3 text-right text-orange-400">{log.geocode_failed ?? 0}</td>
                    <td className="pr-3 text-right text-green-400">{log.llm_count ?? 0}</td>
                    <td className="pr-3 text-right text-red-400">{log.skipped_count ?? 0}</td>
                    <td className="truncate max-w-[200px] text-red-400">{log.error_message ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Source monitoring panel */}
      {sourcesOverview.length > 0 && (
        <div className="mb-4 rounded-xl bg-white p-4 shadow">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Stato Fonti ({sourcesOverview.length})</h2>
            <button
              onClick={() => {
                setShowSourceMgmt((v) => !v);
                if (!showSourceMgmt) getExternalSources().then(setExtSources).catch(() => {});
              }}
              className="flex items-center gap-1 rounded-lg border border-primary/30 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/5"
            >
              <Plus className="h-3 w-3" />
              Gestisci Fonti
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-left text-[10px] font-medium text-muted-foreground">
                  <th className="pb-1.5 pr-3">Fonte</th>
                  <th className="pb-1.5 pr-3">Tipo</th>
                  <th className="pb-1.5 pr-3">Stato</th>
                  <th className="pb-1.5 pr-3">Ultimo scrape</th>
                  <th className="pb-1.5 pr-2 text-right">Trovate</th>
                  <th className="pb-1.5 pr-2 text-right">Inserite</th>
                  <th className="pb-1.5 pr-2 text-right">Merged</th>
                  <th className="pb-1.5 pr-2 text-right">Durata</th>
                  <th className="pb-1.5">Errore</th>
                </tr>
              </thead>
              <tbody>
                {sourcesOverview.map((s) => {
                  const ago = s.last_scraped_at ? timeAgo(s.last_scraped_at) : null;
                  return (
                    <tr key={s.name} className={`border-b last:border-0 ${s.last_status === "error" ? "bg-red-50" : ""}`}>
                      <td className="py-1.5 pr-3 font-medium">{s.display_name}</td>
                      <td className="py-1.5 pr-3">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                          s.type === "web" ? "bg-blue-100 text-blue-700" :
                          s.type === "api" ? "bg-purple-100 text-purple-700" :
                          s.type === "instagram" ? "bg-pink-100 text-pink-700" :
                          s.type === "facebook" ? "bg-indigo-100 text-indigo-700" :
                          s.type === "search" ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>{s.type}</span>
                      </td>
                      <td className="py-1.5 pr-3">
                        {s.is_active ? (
                          <span className="inline-flex items-center gap-0.5 text-green-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Attivo
                          </span>
                        ) : (
                          <span className="text-gray-400">Disattivato</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        {ago ? (
                          <span title={new Date(s.last_scraped_at!).toLocaleString("it-IT")}>{ago}</span>
                        ) : (
                          <span className="text-gray-400">Mai</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono">{s.last_found ?? "—"}</td>
                      <td className="py-1.5 pr-2 text-right font-mono text-green-600">{s.last_inserted ?? "—"}</td>
                      <td className="py-1.5 pr-2 text-right font-mono text-blue-600">{s.last_merged ?? "—"}</td>
                      <td className="py-1.5 pr-2 text-right font-mono">{s.last_duration_ms ? `${(s.last_duration_ms / 1000).toFixed(0)}s` : "—"}</td>
                      <td className="max-w-[180px] truncate py-1.5 text-red-500">{s.last_error ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Source management panel (expandable) */}
      {showSourceMgmt && (
        <div className="mb-4 rounded-xl bg-white p-4 shadow">
          <h2 className="mb-3 text-sm font-bold">Gestione Fonti Esterne</h2>

          {/* Add new source form */}
          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg bg-muted/30 p-3">
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Tipo</label>
              <select
                value={newSource.type}
                onChange={(e) => setNewSource({ ...newSource, type: e.target.value })}
                className="rounded border px-2 py-1.5 text-xs"
              >
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="rss">RSS</option>
                <option value="other">Altro</option>
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Nome</label>
              <input
                value={newSource.name}
                onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                placeholder="Pro Loco Treviso"
                className="w-full rounded border px-2 py-1.5 text-xs"
              />
            </div>
            <div className="flex-[2] min-w-[200px]">
              <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">URL</label>
              <input
                value={newSource.url}
                onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                placeholder="https://www.instagram.com/prolocotreviso/"
                className="w-full rounded border px-2 py-1.5 text-xs"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Note</label>
              <input
                value={newSource.notes}
                onChange={(e) => setNewSource({ ...newSource, notes: e.target.value })}
                placeholder="Opzionale"
                className="w-full rounded border px-2 py-1.5 text-xs"
              />
            </div>
            <button
              onClick={async () => {
                if (!newSource.name.trim() || !newSource.url.trim()) return;
                setSourceMsg(null);
                const res = await addExternalSource(newSource.type, newSource.name.trim(), newSource.url.trim(), newSource.notes.trim() || undefined);
                if (res.ok) {
                  setNewSource({ type: newSource.type, name: "", url: "", notes: "" });
                  setSourceMsg("Aggiunta!");
                  getExternalSources().then(setExtSources);
                  getSourcesOverview().then(setSourcesOverview);
                } else {
                  setSourceMsg(res.error ?? "Errore");
                }
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
            >
              <Plus className="inline h-3.5 w-3.5 mr-0.5" />
              Aggiungi
            </button>
            {sourceMsg && <span className="text-xs text-muted-foreground">{sourceMsg}</span>}
          </div>

          {/* External sources list */}
          {extSources.length > 0 && (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-left text-[10px] font-medium text-muted-foreground">
                  <th className="pb-1.5 pr-3">Tipo</th>
                  <th className="pb-1.5 pr-3">Nome</th>
                  <th className="pb-1.5 pr-3">URL</th>
                  <th className="pb-1.5 pr-3">Note</th>
                  <th className="pb-1.5 pr-3">Stato</th>
                  <th className="pb-1.5">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {extSources.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                        s.type === "instagram" ? "bg-pink-100 text-pink-700" :
                        s.type === "facebook" ? "bg-indigo-100 text-indigo-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{s.type}</span>
                    </td>
                    <td className="py-1.5 pr-3 font-medium">{s.name}</td>
                    <td className="max-w-[250px] truncate py-1.5 pr-3">
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{s.url}</a>
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{s.notes ?? ""}</td>
                    <td className="py-1.5 pr-3">
                      {s.is_active ? (
                        <span className="text-green-600">Attivo</span>
                      ) : (
                        <span className="text-gray-400">Off</span>
                      )}
                    </td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={async () => {
                            await toggleExternalSource(s.id, !s.is_active);
                            getExternalSources().then(setExtSources);
                            getSourcesOverview().then(setSourcesOverview);
                          }}
                          title={s.is_active ? "Disattiva" : "Attiva"}
                          className={`rounded p-1 ${s.is_active ? "text-orange-500 hover:bg-orange-50" : "text-green-600 hover:bg-green-50"}`}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Eliminare "${s.name}"?`)) return;
                            await deleteExternalSource(s.id);
                            getExternalSources().then(setExtSources);
                            getSourcesOverview().then(setSourcesOverview);
                          }}
                          title="Elimina"
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["needs_review", "pending", "auto_approved", "admin_approved", "admin_rejected", "discarded", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(0); loadTable(); }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              status === s ? "bg-primary text-white" : "bg-white text-muted-foreground hover:bg-muted"
            }`}
          >
            {s === "all" ? "Tutte" : STATUS_LABELS[s]?.label ?? s}
            {s !== "all" && counts[s] != null && (
              <span className="ml-1 opacity-70">({counts[s]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {status === "auto_approved" && (counts.auto_approved ?? 0) > 0 && (
        <button
          onClick={handleBulkApprove}
          disabled={isPending}
          className="mb-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
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
                <th className="px-3 py-2">Titolo</th>
                <th className="px-3 py-2">Luogo</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Conf.</th>
                <th className="px-3 py-2">Stato</th>
                <th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2">Fonte</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2">Img</th>
                <th className="px-3 py-2">Azioni</th>
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
                    {row.start_date ?? "—"}
                    {row.end_date && row.end_date !== row.start_date && (
                      <span className="text-muted-foreground"> → {row.end_date}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.confidence != null ? (
                      <span className={`font-mono text-xs font-bold ${
                        row.confidence >= 70 ? "text-green-600" : row.confidence >= 40 ? "text-yellow-600" : "text-red-500"
                      }`}>
                        {row.confidence}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      STATUS_LABELS[row.review_status ?? ""]?.color ?? "bg-gray-100 text-gray-500"
                    }`}>
                      {STATUS_LABELS[row.review_status ?? ""]?.label ?? row.review_status}
                    </span>
                  </td>
                  <td className="max-w-[200px] px-3 py-2 text-[11px] text-muted-foreground">
                    {getReason(row)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-muted-foreground">
                    {row.source_id ? row.source_id.replace(/^scrape-/, "").replace(/-/g, " ") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <FoodIcons foodTags={row.food_tags} title={row.title} className="h-4 w-4" themed />
                  </td>
                  <td className="group/img relative px-3 py-2">
                    {row.image_url ? (
                      <>
                        <img src={row.image_url} alt="" className="h-8 w-12 rounded object-cover"
                          onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }}
                        />
                        <span className="hidden text-xs text-red-400">✗</span>
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 group-hover/img:block">
                          <img src={row.image_url} alt="" className="h-40 w-60 rounded-lg object-cover shadow-xl" />
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-1">
                      {row.review_status !== "admin_approved" && (
                        <button
                          onClick={() => handleApprove(row.id)}
                          disabled={isPending}
                          title="Approva"
                          className="rounded p-1 text-green-600 hover:bg-green-50 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      {row.review_status !== "admin_rejected" && row.review_status !== "discarded" && (
                        <button
                          onClick={() => handleReject(row.id)}
                          disabled={isPending}
                          title="Rifiuta"
                          className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditId(row.id)}
                        title="Modifica"
                        className="rounded p-1 text-blue-600 hover:bg-blue-50"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {row.source_url && (
                        <a
                          href={row.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Fonte"
                          className="rounded p-1 text-muted-foreground hover:bg-muted"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
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
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{total} sagre totali</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded p-1 hover:bg-muted disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded p-1 hover:bg-muted disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editId && (
        <EditModal
          sagraId={editId}
          onClose={() => setEditId(null)}
          onSaved={() => { setEditId(null); loadTable(); loadPipeline(); }}
        />
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "adesso";
  if (mins < 60) return `${mins}m fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h fa`;
  const days = Math.floor(hrs / 24);
  return `${days}g fa`;
}

function PipelineStat({ label, value, color, prev }: { label: string; value: number; color?: string; prev?: number }) {
  const diff = prev != null ? value - prev : 0;
  return (
    <div className="rounded-lg bg-muted/50 p-2 text-center">
      <div className={`text-lg font-bold ${color ?? "text-foreground"}`}>
        {value}
        {diff !== 0 && (
          <span className={`ml-1 text-xs font-normal ${diff > 0 ? "text-green-500" : "text-red-400"}`}>
            {diff > 0 ? "+" : ""}{diff}
          </span>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
