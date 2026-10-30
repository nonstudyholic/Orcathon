"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

type ParsedForm =
  | { error: string }
  | {
      values: {
        title: string;
        description: string | null;
        category: string;
        status: string;
        metadata: Record<string, unknown>;
      };
    };

function parseForm(formData: FormData): ParsedForm {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Add a title before saving." } as const;

  let metadata: Record<string, unknown> = {};
  const rawMetadata = String(formData.get("metadata") ?? "").trim();
  if (rawMetadata) {
    try {
      const parsed = JSON.parse(rawMetadata);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      metadata = parsed;
    } catch {
      return { error: 'Metadata must be a JSON object, for example {"priority": 2}.' } as const;
    }
  }

  return {
    values: {
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      category: String(formData.get("category") ?? "").trim() || "general",
      status: String(formData.get("status") ?? "").trim() || "todo",
      metadata,
    },
  } as const;
}

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const SESSION_EXPIRED: ActionResult = { ok: false, error: "Your session expired. Log in again." };

export async function createItem(formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const { supabase, user } = await getContext();
  if (!user) return SESSION_EXPIRED;

  const { error } = await supabase.from("items").insert({ ...parsed.values, user_id: user.id });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateItem(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const { supabase, user } = await getContext();
  if (!user) return SESSION_EXPIRED;

  // Row Level Security guarantees users can only update their own rows.
  const { error } = await supabase.from("items").update(parsed.values).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteItem(id: string): Promise<ActionResult> {
  const { supabase, user } = await getContext();
  if (!user) return SESSION_EXPIRED;

  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
