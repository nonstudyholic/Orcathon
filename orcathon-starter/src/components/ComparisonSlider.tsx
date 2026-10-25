"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ANOMALY_KINDS, ORIGIN_STYLES, type Anomaly, type ViewLayer } from "@/types";

function colorFor(a: Anomaly, layer: ViewLayer) {
  return layer === "classification" ? ORIGIN_STYLES[a.origin].color : ANOMALY_KINDS[a.kind].color;
}

/**
 * variant "mask": filled color mask, drawn on the AFTER image (revealed right of the slider).
 * variant "outline": dashed outline only, drawn on the BEFORE image (left of the slider),
 * so you can see where the changed area used to be.
 */
function Overlay({
  anomalies,
  layer,
  emphasizedIds,
  variant,
}: {
  anomalies: Anomaly[];
  layer: ViewLayer;
  emphasizedIds: Set<string>;
  variant: "mask" | "outline";
}) {
  if (layer === "raw") return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {anomalies.map((a) => {
        const color = colorFor(a, layer);
        const on = emphasizedIds.has(a.id);
        const { x, y, w, h } = a.box;
        const showChip = layer === "classification" && variant === "mask";

        return (
          <div
            key={a.id}
            className="absolute"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${w}%`,
              height: `${h}%`,
              borderColor: color,
              borderWidth: on ? 3 : 2,
              borderStyle:
                variant === "outline" ? "dashed" : layer === "classification" && a.origin === "natural" ? "dotted" : "solid",
              backgroundColor: variant === "mask" ? `${color}${on ? "59" : "2e"}` : "transparent",
            }}
          >
            {showChip && (
              <span
                className="absolute left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: color, ...(y < 8 ? { top: 0 } : { bottom: "100%" }) }}
              >
                {ANOMALY_KINDS[a.kind].label}: {ORIGIN_STYLES[a.origin].label}, {Math.round(a.confidence * 100)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ComparisonSlider({
  beforeSrc,
  afterSrc,
  anomalies,
  layer,
  position,
  onPositionChange,
  emphasizedIds,
}: {
  beforeSrc: string;
  afterSrc: string;
  anomalies: Anomaly[];
  layer: ViewLayer;
  position: number; // 0-100
  onPositionChange: (value: number) => void;
  emphasizedIds: Set<string>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [ratio, setRatio] = useState(16 / 9);

  // Size the viewer to the BEFORE image's real proportions.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight);
    };
    img.src = beforeSrc;
  }, [beforeSrc]);

  function setFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    onPositionChange(Math.min(100, Math.max(0, pct)));
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (dragging.current) setFromClientX(e.clientX);
  }
  function endDrag() {
    dragging.current = false;
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft") onPositionChange(Math.max(0, position - step));
    else if (e.key === "ArrowRight") onPositionChange(Math.min(100, position + step));
    else if (e.key === "Home") onPositionChange(0);
    else if (e.key === "End") onPositionChange(100);
    else return;
    e.preventDefault();
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="relative mx-auto cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-lg border border-line bg-ink/5"
      style={{ aspectRatio: ratio, width: `min(100%, ${75 * ratio}vh)` }}
    >
      {/* AFTER: full image + filled masks (base layer) */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afterSrc} alt="After image" draggable={false} className="h-full w-full object-cover" />
        <Overlay anomalies={anomalies} layer={layer} emphasizedIds={emphasizedIds} variant="mask" />
      </div>

      {/* BEFORE: clipped to the left of the slider, with dashed outlines of the same regions */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeSrc} alt="Before image" draggable={false} className="h-full w-full object-cover" />
        <Overlay anomalies={anomalies} layer={layer} emphasizedIds={emphasizedIds} variant="outline" />
      </div>

      <span className="pointer-events-none absolute left-3 top-3 rounded bg-ink/70 px-2 py-0.5 text-xs font-medium text-white">
        Before
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded bg-ink/70 px-2 py-0.5 text-xs font-medium text-white">
        After
      </span>

      {/* Divider + handle */}
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${position}%` }}>
        <div className="absolute inset-y-0 -translate-x-1/2 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
        <div
          role="slider"
          tabIndex={0}
          aria-label="Before and after comparison position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          onKeyDown={onKeyDown}
          className="pointer-events-auto absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-ink shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 7-5 5 5 5" />
            <path d="m15 7 5 5-5 5" />
          </svg>
        </div>
      </div>
    </div>
  );
}
