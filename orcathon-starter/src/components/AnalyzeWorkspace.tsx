"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { classifyWithAi } from "@/app/dashboard/analyze/actions";
import { classifyByRules } from "@/lib/classifyByRules";
import { detectChanges, makeRegionCrops, type Sensitivity } from "@/lib/detectChanges";
import { ANOMALY_KINDS, ORIGIN_STYLES, VIEW_LAYERS, type Anomaly, type ViewLayer } from "@/types";
import ComparisonSlider from "./ComparisonSlider";
import ImageDropzone from "./ImageDropzone";

type Picked = { name: string; url: string } | null;
type Status = "idle" | "detecting" | "classifying" | "done";

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

const SENSITIVITIES: { value: Sensitivity; label: string }[] = [
  { value: "low", label: "Low (fewer, larger regions)" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High (more, smaller regions)" },
];

export default function AnalyzeWorkspace() {
  const [before, setBefore] = useImageSlot();
  const [after, setAfter] = useImageSlot();
  const [layer, setLayer] = useState<ViewLayer>("anomalies");
  const [position, setPosition] = useState(50);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const [sensitivity, setSensitivity] = useState<Sensitivity>("medium");
  const [status, setStatus] = useState<Status>("idle");
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  const ready = Boolean(before && after);
  const busy = status === "detecting" || status === "classifying";

  // New images invalidate any earlier results.
  useEffect(() => {
    runId.current++;
    setAnomalies([]);
    setStatus("idle");
    setNotice(null);
    setError(null);
  }, [before?.url, after?.url]);

  async function runDetection() {
    if (!before || !after) return;
    const id = ++runId.current;
    setStatus("detecting");
    setError(null);
    setNotice(null);
    setAnomalies([]);

    try {
      await new Promise((r) => setTimeout(r, 30)); // let the "Detecting" state paint
      const detection = await detectChanges(before.url, after.url, sensitivity);
      if (id !== runId.current) return;

      if (detection.regions.length === 0) {
        setNotice(detection.warning ?? "No significant changes found. Try a higher sensitivity.");
        setStatus("done");
        return;
      }

      // Show rule-based labels right away, then let the AI review them.
      const ruled = detection.regions.map(classifyByRules);
      setAnomalies(ruled);
      setStatus("classifying");

      const crops = await makeRegionCrops(before.url, after.url, detection.regions);
      const ai = await classifyWithAi(crops);
      if (id !== runId.current) return;

      const warn = detection.warning ? `${detection.warning} ` : "";

      if (!ai.ok) {
        setNotice(
          `${warn}${
            ai.code === "no_key"
              ? "AI review is off because GEMINI_API_KEY is not set."
              : ai.error
          } Showing rule-based labels, which are rough guesses.`
        );
        setStatus("done");
        return;
      }

      const byId = new Map(ai.results.map((r) => [r.id, r]));
      let removed = 0;
      const merged: Anomaly[] = [];
      for (const a of ruled) {
        const r = byId.get(a.id);
        if (!r) {
          merged.push(a);
        } else if (r.kind === "no_change") {
          removed++;
        } else {
          merged.push({
            ...a,
            kind: r.kind,
            origin: r.origin,
            confidence: r.confidence,
            reason: r.reason,
            source: "ai",
          });
        }
      }
      setAnomalies(merged);
      setNotice(
        `${warn}${ruled.length} candidate regions found by pixel comparison.` +
          (removed > 0 ? ` The AI removed ${removed} as lighting, shadow, or seasonal differences.` : "")
      );
      setStatus("done");
    } catch (e) {
      if (id !== runId.current) return;
      setError(e instanceof Error ? e.message : "Detection failed. Try different images.");
      setStatus("idle");
    }
  }

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
  const naturalCount = anomalies.filter((a) => a.origin === "natural").length;
  const unclearCount = anomalies.length - humanCount - naturalCount;
  const aiReviewed = anomalies.length > 0 && anomalies.every((a) => a.source === "ai");

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
        <>
          {/* Detection controls */}
          <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            <div className="sm:w-64">
              <label htmlFor="sensitivity" className="label">
                Sensitivity
              </label>
              <select
                id="sensitivity"
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value as Sensitivity)}
                disabled={busy}
                className="input"
              >
                {SENSITIVITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={runDetection} disabled={busy} className="btn-primary">
              {status === "detecting"
                ? "Comparing pixels..."
                : status === "classifying"
                  ? "AI is reviewing regions..."
                  : status === "done"
                    ? "Run again"
                    : "Detect changes"}
            </button>
            <p className="text-xs text-muted sm:ml-auto sm:max-w-sm" aria-live="polite">
              {status === "idle" && "Compares the two images pixel by pixel, then asks an AI model to label each region."}
              {status === "detecting" && "Looking for areas that differ between the two images."}
              {status === "classifying" && "Rule-based labels are shown now and will be replaced by the AI review."}
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-md bg-accent/10 px-4 py-3 text-sm">
              {notice}
            </p>
          )}

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
                {anomalies.length > 0 && (
                  <span
                    className={`badge ${
                      aiReviewed ? "bg-accent/15 text-accent" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {aiReviewed ? "AI-reviewed labels" : "Rule-based labels"}
                  </span>
                )}
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
                regions on the before side. Confidence is the model&apos;s own estimate, not a measured accuracy.
              </p>
            </section>

            <aside aria-label="Flagged regions" className="min-w-0">
              <h2 className="text-sm font-semibold">
                {anomalies.length} flagged {anomalies.length === 1 ? "region" : "regions"}
              </h2>
              {anomalies.length > 0 && (
                <p className="mt-0.5 text-xs text-muted">
                  {humanCount} human-made, {naturalCount} natural, {unclearCount} unclear
                </p>
              )}

              {anomalies.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  {status === "done" ? "Nothing flagged." : "Run detection to see flagged regions here."}
                </p>
              ) : (
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
                          title={a.reason}
                          className={`card flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                            atSlider ? "border-accent" : ""
                          }`}
                        >
                          <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{ANOMALY_KINDS[a.kind].label}</span>
                            <span className="block text-xs text-muted">
                              {ORIGIN_STYLES[a.origin].label}, {Math.round(a.confidence * 100)}% confidence
                            </span>
                            {a.reason && <span className="mt-1 line-clamp-2 block text-xs text-muted">{a.reason}</span>}
                          </span>
                          {atSlider && <span className="badge shrink-0 bg-accent/15 text-accent">At slider</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {anomalies.length > 0 && <p className="mt-3 text-xs text-muted">Select a region to move the slider to it.</p>}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
