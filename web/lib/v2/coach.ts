import { loadDaysIndex, loadDay, loadFrameworks, nextUnfinishedDay } from "@/lib/program";
import { arcForDay, DAY_ARC, PHASES } from "./journey";
import { getV2Settings, vdb } from "./db";
import { DOMAINS } from "./types";
import type { ProgramDay } from "@/lib/types";

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
  const thermo = await vdb().thermostat.toArray();
  const values = (await vdb().values.toArray()).sort((a, b) => a.rank - b.rank);

  const parts: string[] = [];

  if (s.intentName) parts.push(`## What they're working toward\n${s.intentName}`);

  if (beliefs.length) {
    const lines = beliefs.map((b) => {
      const dom = DOMAINS.find((d) => d.key === b.domain)?.label ?? b.domain;
      return `- [${dom}] ${b.limiting ? `old: "${b.limiting}" → ` : ""}new: "${b.empowering}"`;
    });
    parts.push(`## Beliefs they're rewiring\n${lines.join("\n")}`);
  }

  if (thermo.length) {
    const lines = thermo
      .map((t) => `- ${DOMAINS.find((d) => d.key === t.domain)?.label ?? t.domain}: ${t.level}/100`)
      .join("\n");
    parts.push(`## What they believe they deserve, by area (0–100)\n${lines}`);
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

export function suggestedPrompts(hasBeliefs: boolean): string[] {
  const base = [
    "What should I focus on today?",
    "I'm avoiding something — help me see why.",
    "Where am I drifting?",
  ];
  if (hasBeliefs) base.unshift("Pick a belief I'm stuck on and push me on it.");
  return base.slice(0, 4);
}
