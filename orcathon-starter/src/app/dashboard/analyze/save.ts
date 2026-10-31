"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SaveScanInput = {
  title: string;
  description: string;
  category: string;
  status: string;
  metadata: Record<string, unknown>;
};

type SaveScanResult = { ok: true } | { ok: false; error: string };

const ALLOWED_STATUSES = ["human", "natural", "mixed", "note"];

export async function saveScan(input: SaveScanInput): Promise<SaveScanResult> {
  const title = String(input?.title ?? "").trim().slice(0, 200);
  if (!title) return { ok: false, error: "Give the scan a title before saving." };

  const description = String(input?.description ?? "").trim().slice(0, 4000) || null;
  const category = String(input?.category ?? "").trim().slice(0, 60) || "general";
  const status = ALLOWED_STATUSES.includes(input?.status) ? input.status : "note";

  let metadata: Record<string, unknown> = {};
  if (input?.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)) {
    if (JSON.stringify(input.metadata).length > 30_000) {
      return { ok: false, error: "This scan is too large to save." };
    }
    metadata = input.metadata;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Log in again." };

  const { error } = await supabase
    .from("items")
    .insert({ title, description, category, status, metadata, user_id: user.id });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
