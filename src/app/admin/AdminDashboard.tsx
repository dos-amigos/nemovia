"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
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
  type ReviewStatus,
} from "./actions";
import { EditModal } from "./EditModal";
import { Check, X, ExternalLink, LogOut, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { FoodIcons } from "@/lib/constants/food-icons";

type SagraRow = Awaited<ReturnType<typeof getAdminSagre>>["data"][number];

/** Derive a human-readable reason for the review status */
function getReason(row: SagraRow): string {
  const parts: string[] = [];
  if (row.confidence == null) parts.push("Non ancora analizzata da Gemini");
  else {
    if (row.confidence < 30) parts.push("Confidence troppo bassa (<30)");
    else if (row.confidence < 70) parts.push("Confidence media (" + row.confidence + ")");
    if (!row.start_date) parts.push("Senza data");
    if (!row.enhanced_description) parts.push("Senza descrizione");
    if (!row.food_tags || row.food_tags.length === 0) parts.push("Senza food tags");
    if (!row.image_url) parts.push("Senza immagine");
    if (row.confidence >= 70 && row.start_date) parts.push("Confidence alta + ha data");
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
  const [pipeline, setPipeline] = useState<Awaited<ReturnType<typeof getPipelineStats>> | null>(null);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getAdminSagre(status, page), getStatusCounts(), getPipelineStats()])
      .then(([result, c, p]) => {
        setRows(result.data);
        setTotal(result.total);
        setCounts(c);
        setPipeline(p);
      })
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  function handleApprove(id: string) {
    startTransition(async () => {
      await approveAction(id);
      load();
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      await rejectAction(id);
      load();
    });
  }

  function handleBulkApprove() {
    if (!confirm("Approvare tutte le sagre auto_approved?")) return;
    startTransition(async () => {
      await bulkApproveAutoAction();
      load();
    });
  }

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      router.refresh();
    });
  }

  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Nemovia</h1>
        <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" /> Esci
        </button>
      </div>

      {/* Pipeline stats */}
      {pipeline && (
        <div className="mb-6 rounded-xl bg-white p-4 shadow">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Pipeline Enrichment</h2>
            <div className="flex items-center gap-2">
              {enrichMsg && <span className="text-xs text-green-600">{enrichMsg}</span>}
              <button
                onClick={() => {
                  setEnrichMsg(null);
                  startTransition(async () => {
                    const msg = await triggerEnrichment();
                    setEnrichMsg(msg === "started" ? "Enrichment avviato!" : msg);
                    setTimeout(() => load(), 5000);
                  });
                }}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                Avvia Enrichment
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <PipelineStat label="Totali" value={pipeline.total} />
            <PipelineStat label="Da geocodificare" value={pipeline.pending_geocode} color={pipeline.pending_geocode > 0 ? "text-yellow-600" : undefined} />
            <PipelineStat label="Da analizzare (Gemini)" value={pipeline.pending_llm} color={pipeline.pending_llm > 0 ? "text-orange-600" : undefined} />
            <PipelineStat label="Analizzate" value={pipeline.enriched} color="text-blue-600" />
            <PipelineStat label="Con immagine" value={pipeline.with_image} color="text-purple-600" />
            <PipelineStat label="Attive sul sito" value={pipeline.active} color="text-green-600" />
          </div>
          {pipeline.pending_llm > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              ~{Math.ceil(pipeline.pending_llm / 200)} run necessari per completare l&apos;analisi Gemini ({Math.ceil(pipeline.pending_llm / 200 / 2)} giorni con pg_cron 2x/day, o clicca &quot;Avvia Enrichment&quot; per velocizzare)
            </p>
          )}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["needs_review", "pending", "auto_approved", "admin_approved", "admin_rejected", "discarded", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(0); }}
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
                        <img src={row.image_url} alt="" className="h-8 w-12 rounded object-cover" />
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
          onSaved={() => { setEditId(null); load(); }}
        />
      )}
    </div>
  );
}

function PipelineStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2 text-center">
      <div className={`text-lg font-bold ${color ?? "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
