"use client";

import React, { useEffect, useState } from "react";

interface TrailPoint {
  x: number;
  y: number;
  id: number;
}

export function CelestialCursor() {
  const [points, setPoints] = useState<TrailPoint[]>([]);

  useEffect(() => {
    let counter = 0;
    const handleMouseMove = (e: MouseEvent) => {
      counter++;
      if (counter % 3 !== 0) return; // Throttle for performance

      const newPoint: TrailPoint = {
        x: e.clientX,
        y: e.clientY,
        id: Date.now() + Math.random(),
      };

      setPoints((prev) => [...prev.slice(-12), newPoint]);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {/* Constellation Connecting Lines */}
      <svg className="absolute inset-0 h-full w-full">
        <polyline
          fill="none"
          stroke="rgba(147, 197, 253, 0.25)"
          strokeWidth="1"
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        />
      </svg>

      {/* Star Particles */}
      {points.map((p, index) => (
        <div
          key={p.id}
          className="absolute h-1 w-1 rounded-full bg-blue-200 shadow-[0_0_8px_rgba(147,197,253,0.8)] transition-opacity duration-500"
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
            opacity: (index + 1) / points.length,
          }}
        />
      ))}
    </div>
  );
}
