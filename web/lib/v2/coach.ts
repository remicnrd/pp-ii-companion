import { loadDaysIndex, nextUnfinishedDay } from "@/lib/program";
import { arcForDay } from "./journey";
import { getV2Settings, vdb } from "./db";
import { BELIEF_STATES, DOMAINS } from "./types";

/**
 * A deliberately LIGHT system prompt. Unlike v1 (which stuffed all 20 days of
 * notes + the whole frameworks library into every message), this gives the
 * coach the user's self-model + today's session only. Cheaper, faster, and
 * actually more focused — the coach reasons about *them*, not the curriculum.
 */
export async function buildV2CoachSystem(): Promise<string> {
  const s = await getV2Settings();
  const beliefs = (await vdb().beliefs.toArray()).filter((b) => !b.archivedAt);
  const thermo = await vdb().thermostat.toArray();
  const values = (await vdb().values.toArray()).sort((a, b) => a.rank - b.rank);
  const idx = await loadDaysIndex();
  const progress = await vdb().dayProgress.toArray();
  const done = new Set(progress.filter((p) => p.completedAt).map((p) => p.day));
  const currentDay = nextUnfinishedDay(done, idx.days.length);
  const meta = idx.days.find((d) => d.day === currentDay);
  const arc = arcForDay(currentDay);

  const parts: string[] = [];

  parts.push(`You're a thinking partner for someone working through Tony Robbins' Personal Power II. Not a hype coach — a sharp, warm friend who helps them think clearly and act.

How to write:
- Quiet, specific, useful. No coachy register.
- Skip motivational vocabulary: no "massive", "high-leverage", "you got this", "step into your power", "lean in", "let's go", "trust the process", "unlock", "unleash". Drop that whole register.
- Match their energy. Terse → terse.
- When their question is vague, ask one specific clarifying question and stop.
- Use Tony's frameworks by name when it genuinely helps (NAC, neuro-associations, the thermostat, RPM, anchoring, Dickens Pattern, Ultimate Success Formula). The name is shorthand, not a lecture.
- You can see their self-model below. If a belief they're working on is relevant, work with it directly. If they're drifting from something they named, say it once.
- Default short. Don't end every reply with a question.`);

  if (s.intentName) parts.push(`# What they're becoming\n${s.intentName}`);

  if (beliefs.length) {
    const lines = beliefs.map((b) => {
      const state = BELIEF_STATES.find((x) => x.key === b.state)?.label ?? b.state;
      const dom = DOMAINS.find((d) => d.key === b.domain)?.label ?? b.domain;
      return `- [${dom} · ${state}] ${b.limiting ? `was: "${b.limiting}" → ` : ""}now: "${b.empowering}"`;
    });
    parts.push(`# Beliefs they're rewiring\n${lines.join("\n")}`);
  }

  if (thermo.length) {
    const lines = thermo
      .map((t) => `- ${DOMAINS.find((d) => d.key === t.domain)?.label ?? t.domain}: ${t.level}/100`)
      .join("\n");
    parts.push(`# Their thermostat (what they believe they deserve)\n${lines}`);
  }

  if (values.length) {
    parts.push(`# Their values (ranked)\n${values.map((v, i) => `${i + 1}. ${v.name}${v.rule ? ` — ${v.rule}` : ""}`).join("\n")}`);
  }

  if (meta) {
    parts.push(`# Where they are in the program\nDay ${currentDay} of ${idx.days.length}: "${meta.title}".${arc ? `\nThis session's shift: ${arc.paradigm}` : ""}`);
  }

  return parts.join("\n\n---\n\n");
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
