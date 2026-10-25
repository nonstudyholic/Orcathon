import type { Anomaly } from "@/types";

// PLACEHOLDER DATA. These are fixed example regions used to build and test the
// overlay UI. They are NOT produced by a detection model and will not match
// your images. Replace with real detection output when that feature is built.
export const DEMO_ANOMALIES: Anomaly[] = [
  { id: "demo-1", kind: "forest_loss", origin: "human", confidence: 0.91, box: { x: 8, y: 16, w: 24, h: 22 } },
  { id: "demo-2", kind: "excavation", origin: "human", confidence: 0.78, box: { x: 38, y: 60, w: 16, h: 14 } },
  { id: "demo-3", kind: "infrastructure_damage", origin: "human", confidence: 0.84, box: { x: 58, y: 48, w: 18, h: 20 } },
  { id: "demo-4", kind: "coastal_shift", origin: "natural", confidence: 0.88, box: { x: 68, y: 10, w: 26, h: 16 } },
  { id: "demo-5", kind: "forest_loss", origin: "natural", confidence: 0.67, box: { x: 14, y: 66, w: 18, h: 18 } },
];
