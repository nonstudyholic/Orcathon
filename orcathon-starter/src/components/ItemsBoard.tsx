"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createItem, deleteItem, updateItem } from "@/app/dashboard/actions";
import { STATUSES, statusLabel, type Item } from "@/types";
import ItemForm from "./ItemForm";

const STATUS_STYLES: Record<string, string> = {
  todo: "bg-ink/5 text-muted",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  done: "bg-accent/15 text-accent",
};

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

async function handleUserCorrection(itemId: string, correctedClassification: string) {
  // Update local DB record with user correction for Adaption continuous loop training
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, correction: correctedClassification }),
  });
  
  if (response.ok) {
    alert("Feedback recorded! Adaption AI model loop updated successfully.");
  }
}
  
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
            placeholder="Search items"
            aria-label="Search items"
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
          {showCreate ? "Close form" : "New item"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <section className="card p-5" aria-label="Create item">
          <ItemForm
            submitLabel="Create item"
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
          <p className="font-medium">No items yet</p>
          <p className="mt-1 text-sm text-muted">Create your first item to see it here.</p>
          {!showCreate && (
            <button type="button" onClick={() => setShowCreate(true)} className="btn-primary mt-5">
              New item
            </button>
          )}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No items match your search or filter.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <li key={item.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold leading-snug">{item.title}</h2>
                <span className={`badge shrink-0 ${STATUS_STYLES[item.status] ?? STATUS_STYLES.todo}`}>
                  {statusLabel(item.status)}
                </span>
              </div>

              {item.description && (
                <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-muted">{item.description}</p>
              )}

              {/* HACKATHON: render AI output here, e.g. item.metadata.ai_summary */}

              <div className="mt-4 flex items-center justify-between gap-2 pt-1">
                <p className="text-xs text-muted">
                  {item.category} &middot; {formatDate(item.created_at)}
                </p>
                <div className="flex gap-2">
                  {/* HACKATHON: add an "AI summary" button here */}
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
        <Modal title="Edit item" onClose={() => setEditing(null)}>
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
