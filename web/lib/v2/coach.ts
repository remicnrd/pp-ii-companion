import { loadDaysIndex, loadDay, loadFrameworks, nextUnfinishedDay } from "@/lib/program";
import { oneShot } from "@/lib/llm";
import { arcForDay, DAY_ARC, PHASES } from "./journey";
import { getV2Settings, saveV2Settings, vdb } from "./db";
import { streakFromDates } from "./selfModel";
import { DOMAINS } from "./types";
import type { ProgramDay } from "@/lib/types";
import type { SelfReview } from "./types";

/**
 * Default coach model. The user wants something current that reasons well but
 * isn't the most expensive tier — `gpt-5` is the sweet spot. It's overridable in
 * Settings → Advanced (e.g. `gpt-5-mini` for cheaper, or an OpenRouter model).
 */
export const V2_COACH_MODEL = "gpt-5";

const NAC_LABELS: Record<string, string> = {
  outcome: "What they actually want",
  block: "What's stopping them",
  leverage: "Leverage (cost of staying / reward of changing)",
  newPattern: "The new empowering alternative",
  test: "How they'll test it this week",
};

/** The user's self-model + their own work, assembled once and reused. */
async function assembleSelfModel(): Promise<string> {
  const s = await getV2Settings();
  const beliefs = (await vdb().beliefs.toArray()).filter((b) => !b.archivedAt);
  const thermo = await vdb().thermoAreas.toArray();
  const values = (await vdb().values.toArray()).sort((a, b) => a.rank - b.rank);

  const parts: string[] = [];

  if (s.intentName) parts.push(`## What they're working toward\n${s.intentName}`);

  if (beliefs.length) {
    const lines = beliefs.map((b) => {
      const dom = DOMAINS.find((d) => d.key === b.domain)?.label ?? b.domain;
      const st = streakFromDates(b.conditionedDates ?? []);
      const reps = (b.conditionedDates ?? []).length;
      const rep = st > 0
        ? ` · conditioned ${st}d running`
        : reps
          ? " · named but not conditioned lately"
          : " · named, not yet conditioned";
      return `- [${dom}] ${b.limiting ? `old: "${b.limiting}" → ` : ""}new: "${b.empowering}"${rep}`;
    });
    parts.push(`## Beliefs they're rewiring\n${lines.join("\n")}`);
  }

  if (thermo.length) {
    const lines = thermo
      .map(
        (t) =>
          `- ${t.area || "(unnamed)"}: now "${t.current || "?"}" → should be "${t.target || "?"}"${
            t.conditioning ? ` · conditioning: ${t.conditioning}` : ""
          }`,
      )
      .join("\n");
    parts.push(
      `## Their thermostat — setpoints they're aware of and working to raise\n${lines}`,
    );
  }

  if (values.length) {
    parts.push(
      `## Their values (ranked)\n${values
        .map((v, i) => `${i + 1}. ${v.name}${v.rule ? ` — ${v.rule}` : ""}`)
        .join("\n")}`,
    );
  }

  return parts.join("\n\n");
}

/** The user's own answers, per session they've worked on. This is "their thoughts on the lessons." */
async function assembleTheirWork(): Promise<string> {
  const idx = await loadDaysIndex();
  const progress = await vdb().dayProgress.toArray();
  const engaged = progress
    .filter(
      (p) =>
        p.completedAt ||
        Object.values(p.nac || {}).some((v) => (v || "").trim()),
    )
    .sort((a, b) => a.day - b.day);

  if (!engaged.length) return "";

  const blocks = await Promise.all(
    engaged.map(async (p) => {
      const data = await loadDay(p.day);
      const answers = Object.entries(p.nac || {})
        .map(([k, v]) => {
          const t = (v || "").trim();
          return t ? `- ${NAC_LABELS[k] ?? k}: ${t}` : "";
        })
        .filter(Boolean)
        .join("\n");
      const status = p.completedAt ? " (completed)" : "";
      return `### Day ${p.day} — ${data.title}${status}\n${answers || "(no written notes yet)"}`;
    }),
  );

  const done = new Set(progress.filter((p) => p.completedAt).map((p) => p.day));
  const current = nextUnfinishedDay(done, idx.days.length);
  return `They are on Day ${current} of ${idx.days.length}.\n\n${blocks.join("\n\n")}`;
}

/** The whole program, distilled — summaries, keypoints, frameworks. No transcripts. */
async function assembleProgramKnowledge(): Promise<string> {
  const idx = await loadDaysIndex();
  const frameworks = await loadFrameworks();

  const days: ProgramDay[] = await Promise.all(idx.days.map((d) => loadDay(d.day)));

  const arcBlock = PHASES.map((ph) => {
    const dayLines = DAY_ARC.filter((a) => a.phase === ph.key)
      .map((a) => `  - Day ${a.day}: ${a.paradigm}`)
      .join("\n");
    return `${ph.title} — ${ph.blurb}\n${dayLines}`;
  }).join("\n\n");

  const dayBlock = days
    .map((d) => {
      const kps = d.keypoints.map((k) => `- ${k.title}: ${k.body}`).join("\n");
      const fws = d.frameworks.map((f) => `- ${f.name}`).join("\n") || "(none introduced)";
      return `### Day ${d.day} — ${d.title}\n${d.summary}\n\nKeypoints:\n${kps}\n\nFrameworks:\n${fws}`;
    })
    .join("\n\n");

  const fwBlock = frameworks.frameworks
    .map(
      (f) =>
        `### ${f.name} (Day ${f.introduced_day})\n${f.description}\n` +
        f.steps.map((st, i) => `${i + 1}. ${st.name} — ${st.detail}`).join("\n"),
    )
    .join("\n\n");

  return `## The arc of the program\n${arcBlock}\n\n## Per-day notes\n${dayBlock}\n\n## Frameworks library (with steps)\n${fwBlock}`;
}

/**
 * The coach now gets the FULL picture: the whole program (Tony's ideas,
 * distilled), the user's own work on each session, and their self-model. The
 * user explicitly wants a coach that understands the program and their thinking
 * fully — so this is intentionally rich, unlike the earlier light version.
 */
export async function buildV2CoachSystem(): Promise<string> {
  const [selfModel, theirWork, program] = await Promise.all([
    assembleSelfModel(),
    assembleTheirWork(),
    assembleProgramKnowledge(),
  ]);

  const idx = await loadDaysIndex();
  const progress = await vdb().dayProgress.toArray();
  const done = new Set(progress.filter((p) => p.completedAt).map((p) => p.day));
  const current = nextUnfinishedDay(done, idx.days.length);
  const meta = idx.days.find((d) => d.day === current);
  const arc = arcForDay(current);

  const parts: string[] = [];

  parts.push(`You're a thinking partner for someone working through Tony Robbins' Personal Power II. Not a hype coach — a sharp, warm friend who knows this program cold and helps them think clearly and act.

How to write:
- Quiet, specific, useful. No coachy register.
- Skip motivational vocabulary: no "massive", "high-leverage", "you got this", "step into your power", "lean in", "let's go", "trust the process", "unlock", "unleash". Drop that whole register.
- Match their energy. Terse → terse.
- When their question is vague, ask one specific clarifying question and stop.
- Use Tony's frameworks by name when it genuinely helps (NAC, neuro-associations, the thermostat, RPM, anchoring, Dickens Pattern, Ultimate Success Formula). The name is shorthand, not a lecture.
- You have their full self-model and their own notes on each session below. Work with what's actually there — quote their own words back, connect a question to a belief they named, notice when they're drifting from something they committed to. Don't be generic.
- Default short. Don't end every reply with a question.`);

  if (meta) {
    parts.push(
      `# Where they are right now\nDay ${current} of ${idx.days.length}: "${meta.title}".${arc ? `\nThis session's shift: ${arc.paradigm}` : ""}`,
    );
  }

  if (selfModel) parts.push(`# Their self-model\n\n${selfModel}`);
  if (theirWork) parts.push(`# Their own work, session by session\n\n${theirWork}`);
  parts.push(`# The program (Tony's material, distilled)\n\n${program}`);

  return parts.join("\n\n---\n\n");
}

/**
 * A standalone Markdown brief the user can download and paste into any other AI
 * (ChatGPT, Claude, etc.). Same knowledge as the coach, framed as context for an
 * outside assistant rather than as a system prompt.
 */
export async function buildCoachMarkdown(): Promise<string> {
  const [selfModel, theirWork, program] = await Promise.all([
    assembleSelfModel(),
    assembleTheirWork(),
    assembleProgramKnowledge(),
  ]);

  const header = `# My Personal Power II context

This is context for an AI assistant. I'm working through Tony Robbins' *Personal Power II* — a 30-day program (here in 20 sessions). Below is the program itself, my own work on it so far, and my self-model. Use it to be a sharp, specific thinking partner: quiet and useful, no motivational filler, reference Tony's frameworks by name (NAC, the thermostat, anchoring, RPM, the Dickens Pattern, the Ultimate Success Formula) when it helps. Match my energy and keep it short unless I ask for depth.`;

  const sections = [header];
  if (selfModel) sections.push(`# My self-model\n\n${selfModel}`);
  if (theirWork) sections.push(`# My work, session by session\n\n${theirWork}`);
  sections.push(`# The program, distilled\n\n${program}`);

  return sections.join("\n\n---\n\n");
}

const REVIEW_SYSTEM = `You're reviewing someone's self-model from Tony Robbins' Personal Power II — their beliefs (limiting → empowering reframes), values, thermostat setpoints, and their own session notes. Give an honest, big-picture read, like a sharp friend who knows the program cold.

You are NOT a format checker. Never nitpick wording, demand numbers, or ask for more detail for its own sake. Judge substance only.

For the SET as a whole (the "overall"):
- Are they working on the right things, or majoring in minor things?
- Is it focused or scattered (too many to condition seriously)?
- Do any beliefs overlap (should merge), or conflict with each other or their stated values?
- Given their intent and notes, is something important missing?
- Are they reframing root causes or surface symptoms?
- Say plainly what's strong — don't manufacture problems.

For EACH belief:
- Is it even the right thing to reframe?
- Is the empowering version sound — identity/present-tense, believable enough to actually condition (not positive-thinking denial), and does it address the real limiting belief instead of dodging it?
- verdict "solid" when it genuinely holds up (say so), "reconsider" when it'd be worth rethinking — with one specific, concrete reason. Don't hedge everything to "reconsider"; affirm what works.

Tone: substance, not hype. Specific to THIS person. No filler.

Respond ONLY with JSON, no prose around it:
{ "overall": "2–5 sentences on the big picture", "beliefs": [ { "id": <number>, "verdict": "solid" | "reconsider", "note": "one specific sentence" } ] }`;

/**
 * Holistic coach review of the self-model. Substantive (right things? sound
 * reframes? well organized?), not a format check. Persists the result so it's
 * there when the user returns; they re-run it after adding/changing cards.
 */
export async function reviewSelfModel(): Promise<SelfReview> {
  const s = await getV2Settings();
  if (!s.apiKey) throw new Error("Add your API key in Settings to use review.");

  const beliefs = (await vdb().beliefs.toArray()).filter((b) => !b.archivedAt);
  const values = (await vdb().values.toArray()).sort((a, b) => a.rank - b.rank);
  const thermo = await vdb().thermoAreas.toArray();
  const theirWork = await assembleTheirWork();

  const beliefBlock =
    beliefs
      .map((b) => {
        const dom = DOMAINS.find((d) => d.key === b.domain)?.label ?? b.domain;
        const st = streakFromDates(b.conditionedDates ?? []);
        return `id=${b.id} [${dom}] limiting="${b.limiting || "(none given)"}" empowering="${b.empowering || "(none)"}" conditioned=${st}d`;
      })
      .join("\n") || "(no beliefs yet)";

  const payload = `# THEIR INTENT
${s.intentName || "(not set)"}

# THEIR BELIEFS — the cards to review
${beliefBlock}

# THEIR VALUES (ranked)
${values.map((v, i) => `${i + 1}. ${v.name}${v.rule ? ` — ${v.rule}` : ""}`).join("\n") || "(none)"}

# THEIR THERMOSTAT SETPOINTS
${thermo.map((t) => `- ${t.area || "(unnamed)"}: now "${t.current}" → should be "${t.target}"`).join("\n") || "(none)"}

# THEIR OWN SESSION NOTES (their interpretation of the program)
${theirWork || "(none yet)"}`;

  const raw = await oneShot(
    { apiKey: s.apiKey, baseURL: s.baseURL, model: s.model || V2_COACH_MODEL },
    { system: REVIEW_SYSTEM, user: payload },
  );

  let parsed: { overall?: string; beliefs?: { id: number; verdict: string; note: string }[] } = {};
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : raw);
  } catch {
    throw new Error("Couldn't read the review — try again.");
  }

  const review: SelfReview = {
    overall: (parsed.overall || "").trim() || "No overall read returned — try again.",
    beliefs: (parsed.beliefs || [])
      .filter((b) => typeof b.id === "number")
      .map((b) => ({
        id: b.id,
        verdict: b.verdict === "solid" ? "solid" : "reconsider",
        note: (b.note || "").trim(),
      })),
    generatedAt: Date.now(),
  };

  await saveV2Settings({ review });
  return review;
}

export function suggestedPrompts(hasBeliefs: boolean): string[] {
  const base = [
    "What should I focus on today?",
    "I'm avoiding something — help me see why.",
    "Where am I drifting?",
  ];
  if (hasBeliefs) base.unshift("Pick a belief I'm stuck on and push me on it.");
  return base.slice(0, 4);
}
