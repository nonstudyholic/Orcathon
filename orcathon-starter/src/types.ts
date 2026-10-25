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

// Change these to fit your hackathon idea. `status` is free text in the database.
export const STATUSES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
] as const;

export type ViewLayer = "raw" | "anomalies" | "classification";

export type AnomalyKind = "forest_loss" | "infrastructure_damage" | "excavation" | "coastal_shift";
export type AnomalyOrigin = "natural" | "human";

export type Anomaly = {
  id: string;
  kind: AnomalyKind;
  origin: AnomalyOrigin;
  confidence: number; // 0 to 1
  // Position as a percentage of the image (0-100), so it scales with any display size.
  box: { x: number; y: number; w: number; h: number };
};

// Anomaly layer colors the regions by what changed.
export const ANOMALY_KINDS: Record<AnomalyKind, { label: string; color: string }> = {
  forest_loss: { label: "Forest loss", color: "#22c55e" },
  infrastructure_damage: { label: "Infrastructure damage", color: "#ec4899" },
  excavation: { label: "Land excavation", color: "#f59e0b" },
  coastal_shift: { label: "Coastal shift", color: "#06b6d4" },
};

// Classification layer colors the regions by cause.
export const ORIGIN_STYLES: Record<AnomalyOrigin, { label: string; color: string }> = {
  natural: { label: "Natural", color: "#3b82f6" },
  human: { label: "Human-made", color: "#ef4444" },
};

export const VIEW_LAYERS: { value: ViewLayer; label: string }[] = [
  { value: "raw", label: "Raw imagery" },
  { value: "anomalies", label: "Anomaly layer" },
  { value: "classification", label: "Classification" },
];
export const CATEGORY_SUGGESTIONS = ["general", "idea", "task", "resource"];

export function statusLabel(value: string) {
  return STATUSES.find((s) => s.value === value)?.label ?? value;
}
