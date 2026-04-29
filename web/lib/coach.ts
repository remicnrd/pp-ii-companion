import { db, getProfile, getSettings } from "./db";
import { loadDaysIndex, loadFrameworks } from "./program";
import { withBasePath } from "./url";
import type { ProgramDay } from "./types";

export async function buildCoachSystem(): Promise<string> {
  const profile = await getProfile();
  const settings = await getSettings();
  const days = await loadDaysIndex();
  const frameworks = await loadFrameworks();
  const commitments = await db().commitments.toArray();
  const memories = await db().memories.toArray();

  // Per-day program content: keypoints + frameworks + exercise prompts.
  // No raw transcripts — too noisy and too expensive; the structured notes
  // below are what the user actually distilled from each session.
  const programDays: ProgramDay[] = await Promise.all(
    days.days.map(async (d) => {
      const padded = d.day.toString().padStart(2, "0");
      const res = await fetch(withBasePath(`/program-data/day-${padded}.json`));
      return await res.json();
    }),
  );

  const startDate = settings.startDate;
  const today = new Date().toISOString().slice(0, 10);

  const sections: string[] = [];

  // Tone instructions — explicit anti-patterns because models default to coach-bro voice.
  sections.push(`You're a thinking partner for someone going through Personal Power II. Not a coach in the motivational sense. Closer to a friend they trust to think clearly with them about their actual work and life.

How to write:
- Quiet, specific, useful. No coachy register at all.
- Skip motivational vocabulary entirely. Don't say "massive", "high-leverage", "highest-lever", "you got this", "step into your power", "lean in", "make it happen", "let's go", "trust the process", "embrace the". That whole register, dropped.
- Match the user's energy. Terse → terse. Reflective → reflective.
- When their question is vague, return one specific clarifying question and stop. Don't speculate.
- Reference Tony's frameworks by name when it actually helps (NAC, Dickens Pattern, threshold, RPM, anchoring, the Ultimate Success Formula, etc.). Don't lecture; the name is just shorthand.
- If they've committed to something and seem to be drifting, say it once. Don't moralize.
- Don't end every reply with a question. Only when one would actually move them.
- Default to short. A paragraph or two. Long replies usually mean padding.
- If they ask you to remember something durable, say "saved" — they can confirm via the memory button.

You have access to: their personal profile, the program's per-day notes (summary + keypoints + frameworks + exercise prompts), the consolidated frameworks library, their commitments (with daily-streak data), and any saved memories. You do NOT have full transcripts — refer to keypoints and framework names instead of "Tony said".`);

  if (profile?.generatedSummary) {
    sections.push(`# Who they are\n\n${profile.generatedSummary}`);
  }

  if (startDate) {
    sections.push(`# Calendar\n\nThey started the program on ${startDate}. Today is ${today}.`);
  }

  const liveCommitments = commitments.filter((c) => !c.archivedAt);
  if (liveCommitments.length > 0) {
    const daily = liveCommitments.filter((c) => c.classification === "daily");
    const onceActive = liveCommitments.filter(
      (c) => c.classification === "once" && c.status === "active",
    );
    const onceDone = liveCommitments.filter(
      (c) => c.classification === "once" && c.status === "done",
    );
    const lines: string[] = [];
    if (daily.length) {
      lines.push("## Daily (habits / rituals — running counters)");
      for (const c of daily) {
        const sources = c.sources?.length
          ? ` · day${c.sources.length > 1 ? "s" : ""} ${c.sources.join(", ")}`
          : "";
        const recent = c.dailyChecks.length
          ? ` · most recent ${c.dailyChecks[c.dailyChecks.length - 1]}`
          : "";
        lines.push(
          `- ${c.text} — done ${c.dailyChecks.length}×${recent}${sources}`,
        );
      }
    }
    if (onceActive.length) {
      lines.push("\n## One-time, still pending");
      for (const c of onceActive) {
        const sources = c.sources?.length
          ? ` · day${c.sources.length > 1 ? "s" : ""} ${c.sources.join(", ")}`
          : "";
        lines.push(`- ${c.text}${sources}${c.rationale ? ` — ${c.rationale}` : ""}`);
      }
    }
    if (onceDone.length) {
      lines.push("\n## One-time, done");
      for (const c of onceDone) lines.push(`- ${c.text}`);
    }
    sections.push(`# Their commitments\n\n${lines.join("\n")}`);
  }

  if (memories.length > 0) {
    sections.push(
      `# Saved memories\n\n${memories.map((m) => "- " + m.text).join("\n")}`,
    );
  }

  const daySummaries = programDays
    .map((d) => {
      const kps = d.keypoints
        .map((k) => `- ${k.title}: ${k.body}`)
        .join("\n");
      const fws =
        d.frameworks.map((f) => `- ${f.name}`).join("\n") || "(none introduced this day)";
      const ex = d.exercise.questions.map((q) => `- ${q.label}`).join("\n");
      return `## Day ${d.day} — ${d.title}

${d.summary}

Keypoints:
${kps}

Frameworks introduced:
${fws}

Exercise questions (what the user was prompted to answer):
${ex}`;
    })
    .join("\n\n");
  sections.push(`# Program — per-day notes\n\n${daySummaries}`);

  const fwBlock = frameworks.frameworks
    .map(
      (f) =>
        `### ${f.name} (Day ${f.introduced_day})\n${f.description}\n` +
        f.steps.map((s, i) => `${i + 1}. ${s.name} — ${s.detail}`).join("\n"),
    )
    .join("\n\n");
  sections.push(`# Frameworks library (with steps)\n\n${fwBlock}`);

  return sections.join("\n\n---\n\n");
}
