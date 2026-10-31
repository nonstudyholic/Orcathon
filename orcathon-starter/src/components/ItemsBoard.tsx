"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createItem, deleteItem, updateItem } from "@/app/dashboard/actions";
import { ANOMALY_KINDS, STATUSES, statusLabel, type Item } from "@/types";
import ItemForm from "./ItemForm";

const STATUS_STYLES: Record<string, string> = {
  human: "bg-red-500/15 text-red-600 dark:text-red-400",
  natural: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  mixed: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  note: "bg-ink/5 text-muted",
};

// Reads the summary numbers stored by "Save scan". Returns null for plain notes.
function scanInfo(item: Item) {
  const m = item.metadata as Record<string, unknown> | null;
  if (!m || m.kind !== "scan") return null;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    regions: num(m.regionCount),
    confidence: num(m.avgConfidence),
    area: num(m.areaFlaggedPct),
    ai: m.aiReviewed === true,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function ItemsBoard({ items }: { items: Item[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!q) return true;
      return [item.title, item.description ?? "", item.category].some((f) => f.toLowerCase().includes(q));
    });
  }, [items, query, statusFilter]);

  function handleDelete(item: Item) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    setDeleteError(null);
    setDeletingId(item.id);
    startTransition(async () => {
      const result = await deleteItem(item.id);
      if (!result.ok) setDeleteError(result.error);
      setDeletingId(null);
    });
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:max-w-xl sm:flex-row">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search scans"
            aria-label="Search scans"
            className="input"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="input sm:w-44"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => setShowCreate((v) => !v)} className="btn-primary" aria-expanded={showCreate}>
          {showCreate ? "Close form" : "Add note"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <section className="card p-5" aria-label="Add note">
          <ItemForm
            submitLabel="Add note"
            resetOnSuccess
            onSubmit={(fd) => createItem(fd)}
            onDone={() => setShowCreate(false)}
            onCancel={() => setShowCreate(false)}
          />
        </section>
      )}

      {deleteError && (
        <p role="alert" className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {deleteError}
        </p>
      )}

      {/* Grid */}
      {items.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="font-medium">No saved scans yet</p>
          <p className="mt-1 text-sm text-muted">Run an analysis and press &ldquo;Save scan&rdquo; to build your history.</p>
          <Link href="/dashboard/analyze" className="btn-primary mt-5">
            Open the analyzer
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No scans match your search or filter.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <li key={item.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold leading-snug">{item.title}</h2>
                <span className={`badge shrink-0 ${STATUS_STYLES[item.status] ?? STATUS_STYLES.note}`}>
                  {statusLabel(item.status)}
                </span>
              </div>

              {item.description && (
                <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-muted">{item.description}</p>
              )}

              {(() => {
                const info = scanInfo(item);
                if (!info) return null;
                return (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {info.regions !== null && <span className="badge bg-ink/5 text-muted">{info.regions} regions</span>}
                    {info.confidence !== null && (
                      <span className="badge bg-ink/5 text-muted">{Math.round(info.confidence * 100)}% confidence</span>
                    )}
                    {info.area !== null && <span className="badge bg-ink/5 text-muted">{info.area}% area</span>}
                    <span className="badge bg-ink/5 text-muted">{info.ai ? "AI-reviewed" : "Rule-based"}</span>
                  </div>
                );
              })()}

              <div className="mt-4 flex items-center justify-between gap-2 pt-1">
                <p className="text-xs text-muted">
                  {(ANOMALY_KINDS as Record<string, { label: string }>)[item.category]?.label ?? item.category} &middot;{" "}
                  {formatDate(item.created_at)}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(item)} className="btn-ghost !px-2.5 !py-1.5">
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    className="btn-danger !px-2.5 !py-1.5"
                  >
                    {deletingId === item.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title="Edit entry" onClose={() => setEditing(null)}>
          <ItemForm
            initial={editing}
            submitLabel="Save changes"
            onSubmit={(fd) => updateItem(editing.id, fd)}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 sm:max-w-lg sm:rounded-b-lg"
      >
        <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  );
}
