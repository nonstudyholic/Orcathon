# Adding an LLM during the hackathon

Goal: take an item's `title` and `description`, call an LLM from the server, and save the result in `items.metadata` (no schema change needed).
The API key stays on the server, so never prefix it with `NEXT_PUBLIC_`.

## 1. Add your key

Local: put it in `.env.local`. Production: Vercel -> Project -> Settings -> Environment Variables, then redeploy.

```
GEMINI_API_KEY=...
# or
OPENAI_API_KEY=...
```

## 2. Create `src/lib/ai.ts` (no SDK required)

Pick one provider. Check the provider docs for the current model name.

```ts
// Gemini (free tier available in Google AI Studio)
export async function generateText(prompt: string): Promise<string> {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
```

```ts
// OpenAI alternative
export async function generateText(prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
```

## 3. Add a Server Action in `src/app/dashboard/actions.ts`

```ts
import { generateText } from "@/lib/ai";

export async function generateAiSummary(id: string): Promise<ActionResult> {
  const { supabase, user } = await getContext();
  if (!user) return SESSION_EXPIRED;

  // RLS means this only returns the item if it belongs to the user.
  const { data: item, error } = await supabase.from("items").select("*").eq("id", id).single();
  if (error || !item) return { ok: false, error: "Item not found." };

  try {
    const text = await generateText(
      `Summarize this in 2 sentences, then list 3 concrete next steps.\n\nTitle: ${item.title}\nDescription: ${item.description ?? ""}`
    );
    const { error: updateError } = await supabase
      .from("items")
      .update({
        metadata: { ...item.metadata, ai_summary: text, ai_generated_at: new Date().toISOString() },
      })
      .eq("id", id);
    if (updateError) return { ok: false, error: updateError.message };
  } catch {
    return { ok: false, error: "The AI request failed. Try again in a moment." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
```

## 4. Wire it into the UI

In `src/components/ItemsBoard.tsx`, next to the `HACKATHON` comments:
- Add an "AI summary" button that calls `generateAiSummary(item.id)` inside `startTransition`, and disable it while pending.
- Render `item.metadata.ai_summary` under the description when it exists.

## Tips for a 4.5 hour event

- Ask the model for JSON (`Respond only with JSON: {"summary": "...", "steps": ["..."]}`) and `JSON.parse` it if you want structured UI like checklists.
- Add `export const maxDuration = 30;` to `src/app/dashboard/page.tsx` so Vercel does not cut off slow responses.
- Always show a loading state and an error message. Judges score Functionality & Execution, and a silent failure looks broken.
- Keep a hard-coded fallback response ready in case the API is rate limited during your demo.
