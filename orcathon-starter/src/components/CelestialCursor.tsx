"use client";

import React, { useEffect, useState } from "react";

interface TrailPoint {
  x: number;
  y: number;
  id: number;
  born: number; // timestamp in ms, used to fade the point out
}

// How long a point stays fully visible, and when it is completely gone.
const FADE_START_MS = 1500;
const LIFETIME_MS = 2800;

function lifeOpacity(age: number) {
  if (age <= FADE_START_MS) return 1;
  return Math.max(0, 1 - (age - FADE_START_MS) / (LIFETIME_MS - FADE_START_MS));
}

export function CelestialCursor() {
  const [points, setPoints] = useState<TrailPoint[]>([]);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let counter = 0;
    const handleMouseMove = (e: MouseEvent) => {
      counter++;
      if (counter % 3 !== 0) return; // Throttle for performance

      const t = Date.now();
      const newPoint: TrailPoint = {
        x: e.clientX,
        y: e.clientY,
        id: t + Math.random(),
        born: t,
      };

      setNow(t);
      setPoints((prev) => [...prev.slice(-12), newPoint]);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // While there are points on screen, tick often enough to fade them smoothly
  // and drop the ones that have expired. The timer stops when the trail is empty.
  const active = points.length > 0;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setPoints((prev) => {
        const kept = prev.filter((p) => t - p.born < LIFETIME_MS);
        return kept.length === prev.length ? prev : kept;
      });
    }, 60);
    return () => clearInterval(timer);
  }, [active]);

  const opacities = points.map((p, index) => {
    const position = (index + 1) / points.length; // older points are dimmer
    return position * lifeOpacity(Math.max(0, now - p.born));
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {/* Constellation connecting lines, with a soft glow */}
      <svg
        className="absolute inset-0 h-full w-full"
        style={{
          filter: "drop-shadow(0 0 3px rgba(147, 197, 253, 0.9)) drop-shadow(0 0 9px rgba(96, 165, 250, 0.6))",
        }}
      >
        {points.slice(1).map((p, i) => {
          const prev = points[i];
          const opacity = Math.min(opacities[i], opacities[i + 1]);
          return (
            <line
              key={p.id}
              x1={prev.x}
              y1={prev.y}
              x2={p.x}
              y2={p.y}
              stroke="rgb(191, 219, 254)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity={0.6 * opacity}
            />
          );
        })}
      </svg>

      {/* Star particles */}
      {points.map((p, index) => (
        <div
          key={p.id}
          className="absolute h-1.5 w-1.5 rounded-full bg-blue-100"
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
            transform: "translate(-50%, -50%)",
            opacity: opacities[index],
            boxShadow: "0 0 6px 2px rgba(191, 219, 254, 0.9), 0 0 16px 5px rgba(96, 165, 250, 0.55)",
            transition: "opacity 80ms linear",
          }}
        />
      ))}
    </div>
  );
}
