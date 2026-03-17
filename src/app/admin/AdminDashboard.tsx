"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminSagre,
  getStatusCounts,
  approveAction,
  rejectAction,
  bulkApproveAutoAction,
  logoutAction,
  type ReviewStatus,
} from "./actions";
import { EditModal } from "./EditModal";
import { Check, X, ExternalLink, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { FoodIcons } from "@/lib/constants/food-icons";

type SagraRow = Awaited<ReturnType<typeof getAdminSagre>>["data"][number];

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

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getAdminSagre(status, page), getStatusCounts()])
      .then(([result, c]) => {
        setRows(result.data);
        setTotal(result.total);
        setCounts(c);
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
                  <td className="px-3 py-2">
                    <FoodIcons foodTags={row.food_tags} title={row.title} className="h-4 w-4" themed />
                  </td>
                  <td className="px-3 py-2">
                    {row.image_url ? (
                      <img src={row.image_url} alt="" className="h-8 w-12 rounded object-cover" />
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
