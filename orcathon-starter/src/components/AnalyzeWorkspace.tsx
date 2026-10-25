"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_ANOMALIES } from "@/lib/demoAnomalies";
import { ANOMALY_KINDS, ORIGIN_STYLES, VIEW_LAYERS, type ViewLayer } from "@/types";
import ComparisonSlider from "./ComparisonSlider";
import ImageDropzone from "./ImageDropzone";

type Picked = { name: string; url: string } | null;

// Holds one uploaded image as a temporary browser URL and frees it when replaced.
function useImageSlot() {
  const [slot, setSlot] = useState<Picked>(null);
  const current = useRef<Picked>(null);

  function set(file: File | null) {
    if (current.current) URL.revokeObjectURL(current.current.url);
    const next = file ? { name: file.name, url: URL.createObjectURL(file) } : null;
    current.current = next;
    setSlot(next);
  }

  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current.url);
    },
    []
  );

  return [slot, set] as const;
}

export default function AnalyzeWorkspace() {
  const [before, setBefore] = useImageSlot();
  const [after, setAfter] = useImageSlot();
  const [layer, setLayer] = useState<ViewLayer>("anomalies");
  const [position, setPosition] = useState(50);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const ready = Boolean(before && after);

  // HACKATHON: replace DEMO_ANOMALIES with real detection results later.
  const anomalies = ready ? DEMO_ANOMALIES : [];

  // A region is emphasized while the slider is inside it, or while its list row is hovered.
  const emphasizedIds = useMemo(() => {
    const ids = new Set<string>();
    anomalies.forEach((a) => {
      if (position >= a.box.x && position <= a.box.x + a.box.w) ids.add(a.id);
    });
    if (hoverId) ids.add(hoverId);
    return ids;
  }, [anomalies, position, hoverId]);

  const humanCount = anomalies.filter((a) => a.origin === "human").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <ImageDropzone
          label="Before (earlier date)"
          hint="PNG, JPG or WebP, up to 15 MB"
          previewUrl={before?.url ?? null}
          fileName={before?.name ?? null}
          onFile={setBefore}
          onClear={() => setBefore(null)}
        />
        <ImageDropzone
          label="After (recent date)"
          hint="Same location as the before image"
          previewUrl={after?.url ?? null}
          fileName={after?.name ?? null}
          onFile={setAfter}
          onClear={() => setAfter(null)}
        />
      </div>

      {!ready ? (
        <div className="card px-6 py-12 text-center">
          <p className="font-medium">Add a before and an after image</p>
          <p className="mt-1 text-sm text-muted">The comparison slider appears once both images are loaded.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <section aria-label="Before and after comparison" className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-md border border-line bg-surface p-0.5" role="group" aria-label="Map layer">
                {VIEW_LAYERS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    aria-pressed={layer === l.value}
                    onClick={() => setLayer(l.value)}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                      layer === l.value ? "bg-accent text-accent-fg" : "text-muted hover:text-ink"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <span className="badge bg-amber-500/15 text-amber-700 dark:text-amber-300">Demo regions</span>
            </div>

            <ComparisonSlider
              beforeSrc={before!.url}
              afterSrc={after!.url}
              anomalies={anomalies}
              layer={layer}
              position={position}
              onPositionChange={setPosition}
              emphasizedIds={emphasizedIds}
            />

            <p className="text-xs text-muted">
              Drag the handle or use the arrow keys. Filled masks show on the after side; dashed outlines mark the same
              regions on the before side. The highlighted regions are placeholder examples until a detection model is
              connected.
            </p>
          </section>

          <aside aria-label="Flagged regions" className="min-w-0">
            <h2 className="text-sm font-semibold">
              {anomalies.length} flagged regions
              <span className="ml-2 font-normal text-muted">
                {humanCount} human-made, {anomalies.length - humanCount} natural
              </span>
            </h2>
            <ul className="mt-3 space-y-2">
              {anomalies.map((a) => {
                const color = layer === "classification" ? ORIGIN_STYLES[a.origin].color : ANOMALY_KINDS[a.kind].color;
                const atSlider = position >= a.box.x && position <= a.box.x + a.box.w;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setPosition(a.box.x + a.box.w / 2)}
                      onMouseEnter={() => setHoverId(a.id)}
                      onMouseLeave={() => setHoverId(null)}
                      onFocus={() => setHoverId(a.id)}
                      onBlur={() => setHoverId(null)}
                      className={`card flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                        atSlider ? "border-accent" : ""
                      }`}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{ANOMALY_KINDS[a.kind].label}</span>
                        <span className="block text-xs text-muted">
                          {ORIGIN_STYLES[a.origin].label}, {Math.round(a.confidence * 100)}% confidence
                        </span>
                      </span>
                      {atSlider && <span className="badge bg-accent/15 text-accent">At slider</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted">Select a region to move the slider to it.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
