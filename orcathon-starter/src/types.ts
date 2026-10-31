export type Item = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

// `status` is free text in the database. For saved scans it records the cause of the changes.
export const STATUSES = [
  { value: "human", label: "Human-made" },
  { value: "natural", label: "Natural" },
  { value: "mixed", label: "Mixed causes" },
  { value: "note", label: "Note" },
] as const;

export const CATEGORY_SUGGESTIONS = [
  "general",
  "forest_loss",
  "infrastructure_damage",
  "excavation",
  "coastal_shift",
  "unclassified",
];

export function statusLabel(value: string) {
  return STATUSES.find((s) => s.value === value)?.label ?? value;
}

// ---------------------------------------------------------------------------
// Satellite change analysis
// ---------------------------------------------------------------------------

export type ViewLayer = "raw" | "anomalies" | "classification";

export type AnomalyKind =
  | "forest_loss"
  | "infrastructure_damage"
  | "excavation"
  | "coastal_shift"
  | "unclassified";
export type AnomalyOrigin = "natural" | "human" | "unknown";

export type Anomaly = {
  id: string;
  kind: AnomalyKind;
  origin: AnomalyOrigin;
  confidence: number; // 0 to 1
  // Position as a percentage of the image (0-100), so it scales with any display size.
  box: { x: number; y: number; w: number; h: number };
  // "rules" = simple color/shape rules in the browser. "ai" = reviewed by the vision model.
  source: "rules" | "ai";
  reason?: string;
};

// Anomaly layer colors the regions by what changed.
export const ANOMALY_KINDS: Record<AnomalyKind, { label: string; color: string }> = {
  forest_loss: { label: "Forest loss", color: "#22c55e" },
  infrastructure_damage: { label: "Infrastructure damage", color: "#ec4899" },
  excavation: { label: "Land excavation", color: "#f59e0b" },
  coastal_shift: { label: "Coastal shift", color: "#06b6d4" },
  unclassified: { label: "Unclassified change", color: "#94a3b8" },
};

// Classification layer colors the regions by cause.
export const ORIGIN_STYLES: Record<AnomalyOrigin, { label: string; color: string }> = {
  natural: { label: "Natural", color: "#3b82f6" },
  human: { label: "Human-made", color: "#ef4444" },
  unknown: { label: "Cause unclear", color: "#94a3b8" },
};

export const VIEW_LAYERS: { value: ViewLayer; label: string }[] = [
  { value: "raw", label: "Raw imagery" },
  { value: "anomalies", label: "Anomaly layer" },
  { value: "classification", label: "Classification" },
];
