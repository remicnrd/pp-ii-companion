import {
  db,
  getProfile,
  getSettings,
  getSynthesis,
  saveSynthesis,
} from "./db";
import { oneShot } from "./llm";
import type { Commitment, ProgramDay } from "./types";

type ExtractedItem = {
  mode: "new" | "merge";
  mergeWithId?: number;
  text: string;
  classification: "one-time" | "ongoing";
  rationale?: string;
};

/**
 * Extract commitments from one day's exercise answers, deduping against existing
 * active commitments. The LLM either creates a new commitment or merges into an
 * existing one (updating its text + rationale to reflect the reinforcement).
 *
 * Returns the number of new + merged items. No-op if there are no answers.
 */
export async function extractAndDedupCommitments(
  day: ProgramDay,
  answers: Record<string, string>,
): Promise<{ created: number; merged: number; skipped: number }> {
  const settings = await getSettings();
  const apiKey = settings.apiKey;
  if (!apiKey) {
    // No key — fall back to plain inserts so the user doesn't lose their answers.
    let created = 0;
    for (const q of day.exercise.questions) {
      const text = (answers[q.id] || "").trim();
      if (!text) continue;
      await db().commitments.add({
        day: day.day,
        questionId: q.id,
        text,
        classification: "unclassified",
        status: "active",
        createdAt: Date.now(),
      });
      created += 1;
    }
    return { created, merged: 0, skipped: 0 };
  }

  const answersText = day.exercise.questions
    .map((q) => {
      const ans = (answers[q.id] || "").trim();
      return ans ? `Q: ${q.label}\nA: ${ans}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  if (!answersText) return { created: 0, merged: 0, skipped: 0 };

  const existingActive = (await db().commitments.toArray()).filter(
    (c) => c.status === "active",
  );

  const existingBlock = existingActive.length
    ? existingActive
        .map(
          (c) =>
            `id=${c.id} | day=${c.day} | classification=${c.classification} | text="${c.text}"`,
        )
        .join("\n")
    : "(none yet)";

  const raw = await oneShot(
    { apiKey, baseURL: settings.baseURL, model: settings.model },
    {
      system: `You extract commitments from a user's exercise answers in Tony Robbins' Personal Power II.

You receive:
1. The user's existing active commitments (with ids).
2. Today's exercise answers.

For each distinct commitment in today's answers:
- If it's substantively the SAME or a clear reinforcement of an existing commitment, choose mode "merge" with that mergeWithId. Provide the updated text (the cleaner combined statement) and updated rationale.
- Otherwise mode "new". Provide text + classification + rationale.

Classifications:
- "one-time": a discrete action they'll take once
- "ongoing": a habit, ritual, rule, or recurring practice

Rules:
- A reinforcement of an existing ongoing commitment from a later session = MERGE, not duplicate.
- Don't invent commitments not actually present in the answers.
- text is concise (<= 22 words), rationale <= 18 words.
- If the answers contain no clear commitment, return [].

Respond ONLY with a JSON array. No prose. Each item:
{ "mode": "new" | "merge", "mergeWithId": number?, "text": string, "classification": "one-time" | "ongoing", "rationale": string? }`,
      user: `EXISTING ACTIVE COMMITMENTS:\n${existingBlock}\n\n---\n\nDAY ${day.day} — "${day.title}"\n\n${answersText}`,
    },
  );

  let items: ExtractedItem[] = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    items = JSON.parse(match ? match[0] : raw);
  } catch {
    items = [];
  }

  let created = 0;
  let merged = 0;
  let skipped = 0;
  for (const it of items) {
    if (it.mode === "merge" && typeof it.mergeWithId === "number") {
      const target = existingActive.find((c) => c.id === it.mergeWithId);
      if (!target?.id) {
        skipped += 1;
        continue;
      }
      await db().commitments.update(target.id, {
        text: it.text || target.text,
        classification: it.classification || target.classification,
        rationale: it.rationale || target.rationale,
        lastReviewedAt: Date.now(),
      });
      merged += 1;
    } else {
      await db().commitments.add({
        day: day.day,
        questionId: "extracted",
        text: it.text,
        classification: it.classification,
        rationale: it.rationale,
        status: "active",
        createdAt: Date.now(),
      });
      created += 1;
    }
  }

  return { created, merged, skipped };
}

/**
 * Generate a fresh synthesis paragraph over all commitments + the user's profile.
 * Only runs if there are commitments and the user has an API key configured.
 *
 * Triggers callers should use:
 *  - immediately after `extractAndDedupCommitments` if anything changed
 *  - after a status change (done / abandoned / reactivated / deleted)
 *  - when Momentum loads, if the stored synthesis is older than 24h
 */
export async function regenerateSynthesis(): Promise<void> {
  const settings = await getSettings();
  if (!settings.apiKey) return;
  const all = await db().commitments.toArray();
  if (all.length === 0) return;
  const profile = await getProfile();

  const block = all
    .map(
      (c) =>
        `- [${c.status}, ${c.classification}, day ${c.day}] ${c.text}${
          c.rationale ? ` (${c.rationale})` : ""
        }`,
    )
    .join("\n");

  const profileBlock = profile?.generatedSummary
    ? `## User profile\n${profile.generatedSummary}\n\n`
    : "";

  const text = await oneShot(
    {
      apiKey: settings.apiKey,
      baseURL: settings.baseURL,
      model: settings.model,
    },
    {
      system: `You synthesize a tight overview of someone's commitments across Tony Robbins' Personal Power II program. Your job: surface signal, not summarize.

Output 4 short labelled paragraphs (max 2-3 sentences each):

**Themes:** the patterns across these commitments — what they're really pursuing.
**Loaded right now:** which ongoing commitments would actually compound if maintained, vs which are noise.
**Conflicts or drift:** internal contradictions, or commitments that have gone stale, or one-time actions older than ~7 days that look unfinished. Be specific (cite which one). If none, say so.
**Next push:** the one move that would create the most leverage right now, given their highest-lever work and what they've already committed to. Direct, concrete, non-generic.

Tone: a sharp friend who took notes, not a wellness app. No hype. No "great progress!" Don't pad.`,
      user: `${profileBlock}## All commitments (active + completed + abandoned)\n${block}\n\n## Today's date\n${new Date().toISOString().slice(0, 10)}`,
    },
  );

  await saveSynthesis(text.trim(), all.length);
}

/**
 * Run regenerateSynthesis if it hasn't been generated today yet.
 */
export async function maybeRegenerateSynthesisDaily(): Promise<boolean> {
  const existing = await getSynthesis();
  if (!existing) {
    await regenerateSynthesis();
    return true;
  }
  const last = new Date(existing.generatedAt).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (last !== today) {
    await regenerateSynthesis();
    return true;
  }
  return false;
}
