"use client";

import { useState, useEffect, useTransition } from "react";
import { getAdminSagraById, updateSagraAction, approveAction } from "./actions";
import { X } from "lucide-react";
import { VENETO_PROVINCES } from "@/lib/constants/veneto";

interface EditModalProps {
  sagraId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditModal({ sagraId, onClose, onSaved }: EditModalProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sagra, setSagra] = useState<any>(null);
  const [form, setForm] = useState({
    title: "",
    location_text: "",
    province: "",
    start_date: "",
    end_date: "",
    enhanced_description: "",
    food_tags: "",
    feature_tags: "",
    image_url: "",
    is_free: false,
  });
  const [isPending, startTransition] = useTransition();

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getAdminSagraById(sagraId).then((data) => {
      setSagra(data);
      setForm({
        title: (data.title as string) ?? "",
        location_text: (data.location_text as string) ?? "",
        province: (data.province as string) ?? "",
        start_date: (data.start_date as string) ?? "",
        end_date: (data.end_date as string) ?? "",
        enhanced_description: (data.enhanced_description as string) ?? "",
        food_tags: ((data.food_tags as string[]) ?? []).join(", "),
        feature_tags: ((data.feature_tags as string[]) ?? []).join(", "),
        image_url: (data.image_url as string) ?? "",
        is_free: (data.is_free as boolean) ?? false,
      });
    }).catch((err) => {
      console.error("EditModal load error:", err);
      setLoadError(err instanceof Error ? err.message : "Errore caricamento sagra");
    });
  }, [sagraId]);

  function handleSave() {
    startTransition(async () => {
      await updateSagraAction(sagraId, {
        title: form.title,
        location_text: form.location_text,
        province: form.province,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        enhanced_description: form.enhanced_description || null,
        food_tags: form.food_tags.split(",").map((t) => t.trim()).filter(Boolean),
        feature_tags: form.feature_tags.split(",").map((t) => t.trim()).filter(Boolean),
        image_url: form.image_url || null,
        is_free: form.is_free,
      });
      onSaved();
    });
  }

  function handleSaveAndApprove() {
    startTransition(async () => {
      await updateSagraAction(sagraId, {
        title: form.title,
        location_text: form.location_text,
        province: form.province,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        enhanced_description: form.enhanced_description || null,
        food_tags: form.food_tags.split(",").map((t) => t.trim()).filter(Boolean),
        feature_tags: form.feature_tags.split(",").map((t) => t.trim()).filter(Boolean),
        image_url: form.image_url || null,
        is_free: form.is_free,
      });
      await approveAction(sagraId);
      onSaved();
    });
  }

  if (!sagra) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-xl bg-white p-8 shadow-xl">
          {loadError ? (
            <div className="space-y-2 text-center">
              <p className="text-red-600 font-medium">Errore: {loadError}</p>
              <button onClick={onClose} className="text-sm text-muted-foreground underline">Chiudi</button>
            </div>
          ) : "Caricamento..."}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Modifica Sagra</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Meta info */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>ID: {sagraId.slice(0, 8)}...</span>
          <span>Confidence: {(sagra.confidence as number) ?? "—"}</span>
          <span>Status: {sagra.review_status as string}</span>
          {sagra.source_url && (
            <a href={sagra.source_url as string} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
              Fonte
            </a>
          )}
        </div>

        {/* Image preview */}
        {form.image_url && (
          <img src={form.image_url} alt="" className="mb-4 h-40 w-full rounded-lg object-cover" />
        )}

        <div className="space-y-3">
          <Field label="Titolo" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
          <Field label="Luogo" value={form.location_text} onChange={(v) => setForm((f) => ({ ...f, location_text: v }))} />

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Provincia</label>
            <select
              value={form.province}
              onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {VENETO_PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data inizio" value={form.start_date} onChange={(v) => setForm((f) => ({ ...f, start_date: v }))} type="date" />
            <Field label="Data fine" value={form.end_date} onChange={(v) => setForm((f) => ({ ...f, end_date: v }))} type="date" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrizione</label>
            <textarea
              value={form.enhanced_description}
              onChange={(e) => setForm((f) => ({ ...f, enhanced_description: e.target.value }))}
              rows={4}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <Field
            label="Food tags (virgola separati)"
            value={form.food_tags}
            onChange={(v) => setForm((f) => ({ ...f, food_tags: v }))}
            placeholder="Carne, Verdura, Vino"
          />

          <Field
            label="Feature tags (virgola separati)"
            value={form.feature_tags}
            onChange={(v) => setForm((f) => ({ ...f, feature_tags: v }))}
            placeholder="Musica, Giostre"
          />

          <Field label="URL immagine" value={form.image_url} onChange={(v) => setForm((f) => ({ ...f, image_url: v }))} />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_free}
              onChange={(e) => setForm((f) => ({ ...f, is_free: e.target.checked }))}
              className="rounded"
            />
            Ingresso gratuito
          </label>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            Salva
          </button>
          <button
            onClick={handleSaveAndApprove}
            disabled={isPending}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            Salva e Approva
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
    </div>
  );
}
