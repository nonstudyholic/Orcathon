"use server";

import { createClient } from "@/lib/supabase/server";
import type { AnomalyKind, AnomalyOrigin } from "@/types";

// ---------------------------------------------------------------------------
// Types and constants
// ---------------------------------------------------------------------------

type AiRegionInput = { id: string; before: string; after: string }; // base64 JPEG, no prefix

type AiRegionResult = {
  id: string;
  kind: AnomalyKind | "no_change";
  origin: AnomalyOrigin;
  confidence: number;
  reason: string;
};

type AiResponse =
  | { ok: true; results: AiRegionResult[] }
  | { ok: false; code: "auth" | "no_key" | "failed"; error: string };

type Provider = "openai" | "gemini";

const KINDS: string[] = [
  "forest_loss",
  "infrastructure_damage",
  "excavation",
  "coastal_shift",
  "unclassified",
  "no_change",
];
const ORIGINS: string[] = ["natural", "human", "unknown"];

const PROMPT = `You are a remote sensing analyst. Candidate surface changes were found by comparing two satellite images of the same location (before and after). For each region you get a close-up before image and a close-up after image.

For every region decide:
- kind: one of forest_loss, infrastructure_damage, excavation, coastal_shift, unclassified, no_change. Use no_change when the difference is only lighting, shadow, cloud, haze, season, sensor color, or misalignment and no real surface change is visible. Use unclassified for a real change that fits none of the other kinds.
- origin: natural (wildfire, flood, storm, erosion, tides), human (clearing, mining, construction, demolition, conflict damage), or unknown when the images do not make the cause clear.
- confidence: your honest certainty from 0 to 1. Do not guess; lower the number when unsure.
- reason: one short sentence naming the visible evidence.

Respond with JSON only, in exactly this form, with one entry per region:
{"regions": [{"id": "r1", "kind": "...", "origin": "...", "confidence": 0.0, "reason": "..."}]}`;

class HttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

async function callOpenAI(list: AiRegionInput[], apiKey: string): Promise<string> {
  const content: object[] = [{ type: "text", text: PROMPT }];
  for (const r of list) {
    content.push({ type: "text", text: `Region ${r.id}, BEFORE image:` });
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${r.before}`, detail: "low" } });
    content.push({ type: "text", text: `Region ${r.id}, AFTER image:` });
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${r.after}`, detail: "low" } });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    console.error("OpenAI request failed", res.status, await res.text().catch(() => ""));
    throw new HttpError(res.status);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(list: AiRegionInput[], apiKey: string): Promise<string> {
  const parts: object[] = [{ text: PROMPT }];
  for (const r of list) {
    parts.push({ text: `Region ${r.id}, BEFORE image:` });
    parts.push({ inline_data: { mime_type: "image/jpeg", data: r.before } });
    parts.push({ text: `Region ${r.id}, AFTER image:` });
    parts.push({ inline_data: { mime_type: "image/jpeg", data: r.after } });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
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
    throw new HttpError(res.status);
  }
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
}

// ---------------------------------------------------------------------------
// Server action called by AnalyzeWorkspace
// ---------------------------------------------------------------------------

export async function classifyWithAi(regions: AiRegionInput[]): Promise<AiResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "auth", error: "Your session expired. Log in again." };

  // OpenAI is used if its key is set; otherwise Gemini.
  const provider: Provider | null = process.env.OPENAI_API_KEY
    ? "openai"
    : process.env.GEMINI_API_KEY
      ? "gemini"
      : null;
  if (!provider) {
    return { ok: false, code: "no_key", error: "No OPENAI_API_KEY or GEMINI_API_KEY is set." };
  }

  const list = regions
    .filter((r) => typeof r.id === "string" && typeof r.before === "string" && typeof r.after === "string")
    .filter((r) => r.before.length < 300_000 && r.after.length < 300_000)
    .slice(0, 10);
  if (list.length === 0) return { ok: true, results: [] };

  try {
    const raw =
      provider === "openai"
        ? await callOpenAI(list, process.env.OPENAI_API_KEY!)
        : await callGemini(list, process.env.GEMINI_API_KEY!);

    const text = raw
      .replace(/^\s*```(?:json)?/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const parsed: unknown = JSON.parse(text);
    const items: unknown = Array.isArray(parsed) ? parsed : (parsed as { regions?: unknown })?.regions;
    if (!Array.isArray(items)) throw new Error("Unexpected response shape");

    const validIds = new Set(list.map((r) => r.id));
    const results: AiRegionResult[] = [];
    for (const item of items) {
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
    if (err instanceof HttpError) {
      const msg =
        err.status === 401
          ? "The AI key was rejected. Check it in your environment variables."
          : err.status === 404
            ? "The AI model name was not found. Check OPENAI_MODEL or GEMINI_MODEL."
            : err.status === 429
              ? "The AI service is rate limited or out of credit."
              : `The AI service returned an error (${err.status}).`;
      return { ok: false, code: "failed", error: msg };
    }
    return { ok: false, code: "failed", error: "The AI response could not be read." };
  }
}
