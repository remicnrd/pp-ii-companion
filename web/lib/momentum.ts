import {
  db,
  getProfile,
  getSettings,
  saveSynthesis,
} from "./db";
import { oneShot } from "./llm";
import { loadDay, loadDaysIndex } from "./program";
import type { Commitment, ProgramDay } from "./types";

/**
 * Model used specifically for the momentum regeneration. Picked separately from
 * the chat model because (a) inputs are smaller (no transcripts) and (b) better
 * reasoning matters more for synthesis than per-token cost.
 */
const MOMENTUM_MODEL = "gpt-5.5";

type RegenerateResult = {
  totalCards: number;
  newCards: number;
  archivedCards: number;
  synthesisGenerated: boolean;
};

type LLMCard = {
  key: string;
  text: string;
  classification: "once" | "daily";
  rationale?: string;
  sources?: number[];
};

type LLMResult = {
  commitments: LLMCard[];
  removed_keys?: string[];
  synthesis: string;
};

/**
 * Regenerate the entire commitment set + synthesis from scratch using the LLM,
 * giving it the user's profile + every completed day's content & answers + the
 * existing commitments (so it can reuse keys and preserve progress).
 *
 * - Reuses existing rows when the LLM repeats a key — preserves status / dailyChecks.
 * - Inserts new rows for new keys.
 * - Archives rows whose keys disappear from the LLM output (status preserved,
 *   archivedAt stamped — not deleted).
 *
 * No-op if there's no API key, no completed days, or no answers yet.
 */
export async function regenerateMomentum(): Promise<RegenerateResult> {
  const empty: RegenerateResult = {
    totalCards: 0,
    newCards: 0,
    archivedCards: 0,
    synthesisGenerated: false,
  };
  const settings = await getSettings();
  if (!settings.apiKey) return empty;

  const idx = await loadDaysIndex();
  const allProgress = await db().dayProgress.toArray();

  // Only consider days the user has actually engaged with (has any answer or
  // is marked completed). Per user direction: don't reason about days they haven't done.
  const engagedDays = allProgress.filter((p) => {
    if (p.completedAt) return true;
    return Object.values(p.exerciseAnswers || {}).some((v) => (v || "").trim());
  });
  if (engagedDays.length === 0) return empty;

  // Load each engaged day's full content
  const dayBlocks = await Promise.all(
    engagedDays
      .sort((a, b) => a.day - b.day)
      .map(async (p) => {
        const data: ProgramDay = await loadDay(p.day);
        const answers = Object.entries(p.exerciseAnswers || {})
          .map(([qid, val]) => {
            const q = data.exercise.questions.find((q) => q.id === qid);
            const trimmed = (val || "").trim();
            if (!trimmed) return "";
            return `Q: ${q?.label ?? qid}\nA: ${trimmed}`;
          })
          .filter(Boolean)
          .join("\n\n");

        const keypoints = data.keypoints
          .map((k) => `- ${k.title}: ${k.body}`)
          .join("\n");
        const frameworks = data.frameworks
          .map((f) => `- ${f.name}`)
          .join("\n") || "(none)";
        return `## Day ${p.day} — ${data.title}

${data.summary}

Keypoints:
${keypoints}

Frameworks introduced:
${frameworks}

User's exercise answers:
${answers || "(none)"}`;
      }),
  );

  const profile = await getProfile();
  const existing = await db().commitments.toArray();
  const existingActive = existing.filter((c) => !c.archivedAt);

  const existingBlock = existingActive.length
    ? existingActive
        .map(
          (c) =>
            `key="${c.key}" | classification=${c.classification} | text="${c.text}"${
              c.classification === "daily"
                ? ` | days_done=${c.dailyChecks.length}`
                : ` | status=${c.status}`
            }`,
        )
        .join("\n")
    : "(no existing commitments — first regeneration)";

  const profileBlock = profile?.generatedSummary
    ? `# USER PROFILE\n\n${profile.generatedSummary}\n\n---\n\n`
    : "";

  const totalEngagedOf = `${engagedDays.length} of ${idx.days.length} sessions`;

  const userPayload = `${profileBlock}# SESSIONS THE USER HAS WORKED ON (${totalEngagedOf})

${dayBlocks.join("\n\n---\n\n")}

# THEIR EXISTING COMMITMENT CARDS (with stable keys)

${existingBlock}

# TODAY

${new Date().toISOString().slice(0, 10)}`;

  const raw = await oneShot(
    {
      apiKey: settings.apiKey,
      baseURL: settings.baseURL,
      model: MOMENTUM_MODEL,
    },
    {
      system: `You synthesize the user's commitments and a free-form overview from their work in Tony Robbins' Personal Power II.

You receive: their personal profile, EVERY session they've actually engaged with (transcript distillation + their exercise answers), and their existing commitment cards.

You produce two things:

## 1. Commitment cards
Each card is something the user has actually committed to in their own answers. Two types:

- "once": a discrete action the user will do once (a specific call, a meeting to schedule, a one-off cleanup, finishing a piece of work).
- "daily": a recurring practice — habit, ritual, rule, daily review. Something they should hit every day from now on.

For each card:
- key: stable slug-like id, lowercase-with-hyphens, max 6 words. KEEP existing keys whenever the underlying commitment is the same — even if you reword the text, reuse the key so the user keeps their streak / done state. CREATE new keys only for genuinely new commitments.
- text: tight statement (max 25 words). Action-first. Concrete. No motivational fluff.
- classification: "once" or "daily".
- rationale: short why (max 18 words). What this is connecting to in their life or what session it came from.
- sources: array of day numbers this commitment came from / was reinforced in.

Rules:
- Merge similar/duplicate commitments into one card.
- Don't invent commitments that aren't grounded in the user's answers. If they wrote nothing concrete, that's fine — return fewer cards.
- Keep "once" cards lean — once it's done, it's done. Don't keep accumulating stale ones.
- For "daily" cards, prefer cards that compound (e.g. morning questions, journaling) and would actually move the user's highest-lever work. Avoid trivial things.
- If a previously listed key is no longer represented anywhere in the user's answers, list it under "removed_keys" so we can archive it.

## 2. Synthesis (free-form)
A short write-up of where the user is right now — their patterns, what's loaded, what's drifting, what would create the most leverage next, conflicts you see, anything notable. Do NOT use a fixed template. Pick whatever structure makes the signal cleanest given THIS user's actual content.

Tone for both: a sharp friend who took good notes. Substance, not motivation. No hype. No "great progress!". Be specific to the user's stated work and lever.

## Output

Respond ONLY with this JSON, no prose around it:

{
  "commitments": [{ "key": "...", "text": "...", "classification": "once" | "daily", "rationale": "...", "sources": [int] }],
  "removed_keys": ["..."],
  "synthesis": "..."
}`,
      user: userPayload,
    },
  );

  let parsed: LLMResult | null = null;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : raw);
  } catch {
    parsed = null;
  }
  if (!parsed || !Array.isArray(parsed.commitments)) {
    return empty;
  }

  // ---- Apply the diff ----
  const existingByKey = new Map(existing.map((c) => [c.key, c]));
  const incomingKeys = new Set<string>();
  let newCards = 0;

  for (const card of parsed.commitments) {
    if (!card.key) continue;
    incomingKeys.add(card.key);
    const prev = existingByKey.get(card.key);
    if (prev?.id) {
      // Update text/classification but preserve progress (status, dailyChecks).
      const update: Partial<Commitment> = {
        text: card.text || prev.text,
        rationale: card.rationale || prev.rationale,
        classification: card.classification || prev.classification,
        sources: card.sources || prev.sources,
        archivedAt: undefined,
        lastReviewedAt: Date.now(),
      };
      // If classification changes (e.g. once → daily), preserve dailyChecks but
      // reset done state for "once" reactivations.
      if (card.classification === "daily" && prev.classification === "once") {
        update.status = "active";
      }
      await db().commitments.update(prev.id, update);
    } else {
      await db().commitments.add({
        key: card.key,
        text: card.text,
        classification: card.classification,
        rationale: card.rationale,
        sources: card.sources || [],
        status: "active",
        dailyChecks: [],
        createdAt: Date.now(),
      });
      newCards++;
    }
  }

  // Archive everything not in the incoming set (and not already archived).
  let archivedCards = 0;
  const removeKeys = new Set([
    ...(parsed.removed_keys || []),
  ]);
  for (const c of existing) {
    if (!c.id) continue;
    if (incomingKeys.has(c.key)) continue;
    if (c.archivedAt) continue;
    if (!removeKeys.has(c.key)) {
      // Conservative: only archive if explicitly in removed_keys. Otherwise leave as-is
      // so an LLM omission doesn't silently delete user's data.
      continue;
    }
    await db().commitments.update(c.id, { archivedAt: Date.now() });
    archivedCards++;
  }

  // Synthesis
  let synthesisGenerated = false;
  if (parsed.synthesis && parsed.synthesis.trim()) {
    const total = (await db().commitments.toArray()).filter((c) => !c.archivedAt).length;
    await saveSynthesis(parsed.synthesis.trim(), total);
    synthesisGenerated = true;
  }

  const totalCards = (await db().commitments.toArray()).filter((c) => !c.archivedAt).length;
  return { totalCards, newCards, archivedCards, synthesisGenerated };
}

/** Mark today as a done day for a "daily" commitment. Idempotent. */
export async function markDailyDone(id: number, on?: string): Promise<void> {
  const date = on ?? new Date().toISOString().slice(0, 10);
  const c = await db().commitments.get(id);
  if (!c) return;
  if (!c.dailyChecks.includes(date)) {
    await db().commitments.update(id, {
      dailyChecks: [...c.dailyChecks, date].sort(),
      lastReviewedAt: Date.now(),
    });
  }
}

/** Remove today's mark for a "daily" commitment. */
export async function unmarkDailyDone(id: number, on?: string): Promise<void> {
  const date = on ?? new Date().toISOString().slice(0, 10);
  const c = await db().commitments.get(id);
  if (!c) return;
  const next = c.dailyChecks.filter((d) => d !== date);
  if (next.length !== c.dailyChecks.length) {
    await db().commitments.update(id, {
      dailyChecks: next,
      lastReviewedAt: Date.now(),
    });
  }
}

/** Streak = consecutive days with checks ending today (or yesterday if today missing). */
export function dailyStreak(checks: string[], today = new Date()): number {
  if (checks.length === 0) return 0;
  const set = new Set(checks);
  let streak = 0;
  // Start from today; if today not done, start from yesterday so the streak still counts.
  const start = new Date(today);
  if (!set.has(start.toISOString().slice(0, 10))) {
    start.setDate(start.getDate() - 1);
  }
  for (;;) {
    const iso = start.toISOString().slice(0, 10);
    if (set.has(iso)) {
      streak++;
      start.setDate(start.getDate() - 1);
    } else break;
  }
  return streak;
}

/** Total ratio: dates done out of days since the commitment was created. */
export function dailyRatio(c: Commitment, today = new Date()): { done: number; total: number } {
  const created = new Date(c.createdAt);
  // Compute days inclusive
  const startISO = created.toISOString().slice(0, 10);
  const todayISO = today.toISOString().slice(0, 10);
  const dayCount = Math.max(
    1,
    Math.floor(
      (Date.parse(todayISO) - Date.parse(startISO)) / (1000 * 60 * 60 * 24),
    ) + 1,
  );
  return { done: c.dailyChecks.length, total: dayCount };
}
