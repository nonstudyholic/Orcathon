"use client";

import { useId, useState, type ChangeEvent, type DragEvent } from "react";

const MAX_MB = 15;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export default function ImageDropzone({
  label,
  hint,
  previewUrl,
  fileName,
  onFile,
  onClear,
}: {
  label: string;
  hint: string;
  previewUrl: string | null;
  fileName: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const inputId = useId();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accept(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Use a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That image is larger than ${MAX_MB} MB. Choose a smaller one.`);
      return;
    }
    setError(null);
    onFile(file);
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    accept(e.dataTransfer.files?.[0]);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    accept(e.target.files?.[0]);
    e.target.value = ""; // lets the same file be chosen again
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {previewUrl && (
          <button type="button" onClick={onClear} className="text-xs text-muted underline-offset-4 hover:underline">
            Remove
          </button>
        )}
      </div>

      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative flex h-48 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed text-center transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
          dragOver ? "border-accent bg-accent/10" : "border-line bg-surface hover:bg-ink/5"
        }`}
      >
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED.join(",")}
          onChange={handleChange}
          className="sr-only"
        />

        {previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={`${label} preview`} className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 truncate bg-ink/70 px-3 py-1.5 text-xs text-white">
              {fileName} (click or drop to replace)
            </span>
          </>
        ) : (
          <div className="px-4">
            <svg viewBox="0 0 24 24" className="mx-auto h-7 w-7 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4" />
              <path d="m7 9 5-5 5 5" />
              <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
            <p className="mt-2 text-sm font-medium">Drag an image here, or click to browse</p>
            <p className="mt-1 text-xs text-muted">{hint}</p>
          </div>
        )}
      </label>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
