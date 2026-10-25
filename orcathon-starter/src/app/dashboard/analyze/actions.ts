"use server";

import { createClient } from "@/lib/supabase/server";
import type { AnomalyKind, AnomalyOrigin } from "@/types";

export type AiRegionInput = { id: string; before: string; after: string };

export type AiRegionResult = {
  id: string;
  kind: AnomalyKind | "no_change";
  origin: AnomalyOrigin;
  confidence: number;
  reason: string;
};

export type AiResponse =
  | { ok: true; results: AiRegionResult[] }
  | { ok: false; code: "no_key" | "auth" | "failed"; error: string };

const KINDS = ["forest_loss", "infrastructure_damage", "excavation", "coastal_shift", "unclassified", "no_change"];
const ORIGINS = ["natural", "human", "unknown"];

const PROMPT = `You are a remote sensing analyst. Candidate surface changes were found by comparing two satellite images of the same location (before and after). For each region you get a close-up before image and a close-up after image.

For every region decide:
- kind: one of forest_loss, infrastructure_damage, excavation, coastal_shift, unclassified, no_change. Use no_change when the difference is only lighting, shadow, cloud, haze, season, sensor color, or misalignment and no real surface change is visible. Use unclassified for a real change that fits none of the other kinds.
- origin: natural (wildfire, flood, storm, erosion, tides), human (clearing, mining, construction, demolition, conflict damage), or unknown when the images do not make the cause clear.
- confidence: your honest certainty from 0 to 1. Do not guess; lower the number when unsure.
- reason: one short sentence naming the visible evidence.

Respond with JSON only: an array with one object per region, in this form:
[{"id": "r1", "kind": "...", "origin": "...", "confidence": 0.0, "reason": "..."}]`;

export async function classifyWithAi(regions: AiRegionInput[]): Promise<AiResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "auth", error: "Your session expired. Log in again." };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, code: "no_key", error: "GEMINI_API_KEY is not set." };

  const list = regions
    .filter((r) => typeof r.id === "string" && typeof r.before === "string" && typeof r.after === "string")
    .filter((r) => r.before.length < 300_000 && r.after.length < 300_000)
    .slice(0, 10);
  if (list.length === 0) return { ok: true, results: [] };

  const parts: object[] = [{ text: PROMPT }];
  for (const r of list) {
    parts.push({ text: `Region ${r.id}, BEFORE image:` });
    parts.push({ inline_data: { mime_type: "image/jpeg", data: r.before } });
    parts.push({ text: `Region ${r.id}, AFTER image:` });
    parts.push({ inline_data: { mime_type: "image/jpeg", data: r.after } });
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      console.error("Gemini request failed", res.status, await res.text().catch(() => ""));
      return {
        ok: false,
        code: "failed",
        error: res.status === 429 ? "The AI service is rate limited. Try again in a minute." : `The AI service returned an error (${res.status}).`,
      };
    }

    const data = await res.json();
    const text: string = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();

    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("Unexpected response shape");

    const validIds = new Set(list.map((r) => r.id));
    const results: AiRegionResult[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== "string" || !validIds.has(o.id)) continue;
      if (typeof o.kind !== "string" || !KINDS.includes(o.kind)) continue;
      const origin = typeof o.origin === "string" && ORIGINS.includes(o.origin) ? o.origin : "unknown";
      const confidence = typeof o.confidence === "number" ? Math.min(1, Math.max(0, o.confidence)) : 0.5;
      results.push({
        id: o.id,
        kind: o.kind as AiRegionResult["kind"],
        origin: origin as AnomalyOrigin,
        confidence,
        reason: typeof o.reason === "string" ? o.reason.slice(0, 220) : "",
      });
    }
    return { ok: true, results };
  } catch (err) {
    console.error("AI classification failed", err);
    return { ok: false, code: "failed", error: "The AI response could not be read. Showing rule-based labels instead." };
  }
}
