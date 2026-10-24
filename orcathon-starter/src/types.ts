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

export const CATEGORY_SUGGESTIONS = ["general", "idea", "task", "resource"];

export function statusLabel(value: string) {
  return STATUSES.find((s) => s.value === value)?.label ?? value;
}
