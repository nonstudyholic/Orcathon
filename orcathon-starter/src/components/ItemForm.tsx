"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/app/dashboard/actions";
import { CATEGORY_SUGGESTIONS, STATUSES, type Item } from "@/types";

export default function ItemForm({
  initial,
  submitLabel,
  onSubmit,
  onDone,
  onCancel,
  resetOnSuccess = false,
}: {
  initial?: Item;
  submitLabel: string;
  onSubmit: (formData: FormData) => Promise<ActionResult>;
  onDone?: () => void;
  onCancel?: () => void;
  resetOnSuccess?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasMetadata = initial && Object.keys(initial.metadata ?? {}).length > 0;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setError(null);

    startTransition(async () => {
      const result = await onSubmit(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (resetOnSuccess) form.reset();
      onDone?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="label">
          Title
        </label>
        <input id="title" name="title" required maxLength={200} defaultValue={initial?.title} className="input" />
      </div>

      <div>
        <label htmlFor="description" className="label">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={initial?.description ?? ""}
          className="input resize-y"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="label">
            Category
          </label>
          <input
            id="category"
            name="category"
            list="category-options"
            defaultValue={initial?.category ?? "general"}
            className="input"
          />
          <datalist id="category-options">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="status" className="label">
            Status
          </label>
          <select id="status" name="status" defaultValue={initial?.status ?? "todo"} className="input">
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <details open={hasMetadata} className="text-sm">
        <summary className="cursor-pointer text-muted">Custom fields (JSON)</summary>
        <textarea
          name="metadata"
          rows={4}
          spellCheck={false}
          defaultValue={hasMetadata ? JSON.stringify(initial!.metadata, null, 2) : ""}
          placeholder='{"priority": 2, "link": "https://..."}'
          className="input mt-2 font-mono text-xs"
          aria-label="Custom fields as JSON"
        />
      </details>

      {error && (
        <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        )}
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
