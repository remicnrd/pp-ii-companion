import { getProfile, getSettings } from "./db";
import { oneShot } from "./llm";
import { loadTranscript } from "./program";
import type { ExerciseFeedback, ProgramDay } from "./types";

/**
 * Have the LLM grade the user's answers for a single day's exercise.
 * The model gets the full transcript, the exercise prompt, and the answers,
 * and returns a verdict + a short critical comment. Comment is short and
 * actionable — not encouragement.
 */
export async function checkExerciseAnswers(
  day: ProgramDay,
  answers: Record<string, string>,
): Promise<ExerciseFeedback> {
  const settings = await getSettings();
  if (!settings.apiKey) {
    throw new Error("API key required to check answers.");
  }
  const profile = await getProfile();
  const transcript = await loadTranscript(day.day);

  const answersBlock = day.exercise.questions
    .map((q) => {
      const ans = (answers[q.id] || "").trim();
      return `### ${q.label}\n${ans || "(empty)"}`;
    })
    .join("\n\n");

  const profileBlock = profile?.generatedSummary
    ? `# USER PROFILE\n\n${profile.generatedSummary}\n\n---\n\n`
    : "";

  const raw = await oneShot(
    {
      apiKey: settings.apiKey,
      baseURL: settings.baseURL,
      model: settings.model,
    },
    {
      system: `You grade exercise answers from someone working through Tony Robbins' Personal Power II.

Inputs you'll receive:
1. The full transcript of the day's session (what Tony actually taught).
2. The exercise prompt and questions as designed.
3. The user's answers.
4. Optionally, the user's profile (for context on their highest-lever work).

Your job: judge whether the answers genuinely engage with the exercise as Tony designed it. Look for:
- Are they specific and concrete, or vague platitudes?
- Do they apply the day's actual framework / mechanism, or generic motivation?
- Do they connect to the user's real life and highest-lever work, or stay abstract?
- For each question, is there a real attempt or are they skipped / shallow?

Pick ONE verdict:
- "needs_work" — vague, generic, off-topic, missing key questions, or doesn't apply the day's framework
- "good" — solid engagement, specific, applies the framework, but room to push deeper
- "great" — specific, deep, clearly engaging with the actual lever, no obvious gap

Then write a SHORT comment (max 4 sentences). Direct, useful, not encouraging fluff. Call out the most important specific gap or strength. If "needs_work", say what to deepen and where. If "great", say what made it work so they can repeat it. Reference Tony's actual concepts from the transcript when relevant (use the names — NAC, RPM, threshold, etc.).

Respond ONLY with JSON:
{ "verdict": "needs_work" | "good" | "great", "comment": "<your comment>" }`,
      user: `${profileBlock}# DAY ${day.day} — "${day.title}"

## Exercise as designed

${day.exercise.intro}

Questions:
${day.exercise.questions.map((q) => `- ${q.label} (${q.guidance})`).join("\n")}

---

# USER'S ANSWERS

${answersBlock}

---

# FULL TRANSCRIPT (Tony's session)

${transcript}`,
    },
  );

  let parsed: { verdict?: string; comment?: string } = {};
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : raw);
  } catch {
    parsed = {};
  }
  const verdict = (
    ["needs_work", "good", "great"].includes(parsed.verdict ?? "")
      ? parsed.verdict
      : "needs_work"
  ) as ExerciseFeedback["verdict"];
  const comment = parsed.comment?.trim() || "Couldn't parse a verdict — try again.";
  return {
    verdict,
    comment,
    generatedAt: Date.now(),
    answeredFor: { ...answers },
  };
}

export function feedbackIsStale(
  feedback: ExerciseFeedback | undefined,
  current: Record<string, string>,
): boolean {
  if (!feedback) return false;
  const keys = new Set([
    ...Object.keys(feedback.answeredFor),
    ...Object.keys(current),
  ]);
  for (const k of keys) {
    if ((feedback.answeredFor[k] || "") !== (current[k] || "")) return true;
  }
  return false;
}
