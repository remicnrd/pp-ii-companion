import { db, getProfile, getSettings } from "./db";
import { loadDaysIndex, loadFrameworks, loadTranscript } from "./program";

export async function buildCoachSystem(): Promise<string> {
  const profile = await getProfile();
  const settings = await getSettings();
  const days = await loadDaysIndex();
  const frameworks = await loadFrameworks();
  const commitments = await db().commitments.toArray();
  const memories = await db().memories.toArray();

  // Load all transcripts in parallel — these are the deep context.
  const transcripts = await Promise.all(
    days.days.map(async (d) => ({
      day: d.day,
      title: d.title,
      text: await loadTranscript(d.day),
    })),
  );

  const programDays = await Promise.all(
    days.days.map(async (d) => {
      const padded = d.day.toString().padStart(2, "0");
      const res = await fetch(`/program-data/day-${padded}.json`);
      return await res.json();
    }),
  );

  const startDate = settings.startDate;
  const today = new Date().toISOString().slice(0, 10);

  const sections: string[] = [];

  sections.push(`You are the Coach for someone working through Tony Robbins' Personal Power II.

Your job is to help them apply what they're learning to the highest-leverage parts of their life — not to summarize, hype, or motivate. Be direct, specific, and useful. Push them on what matters; don't soften.

Tone: a sharp friend who has read the entire program and remembers everything they've told you. Substance over slogans. Never write like a LinkedIn motivation post.

Rules:
- If they've skipped or not delivered on commitments, name it. Be honest, not punishing.
- When they ask vague questions, ask one specific clarifier instead of speculating.
- When you cite a framework, name it (e.g. "this is the Dickens Pattern from Day 8").
- If they're drifting toward small wins ("wake at 6am") instead of high-leverage work, redirect without preachiness.
- If they ask you to remember something durable, say "saved" — the user can confirm via a memory button.
- Keep responses tight. Don't pad. End with a question only when one would actually unstick them.`);

  if (profile?.generatedSummary) {
    sections.push(`# WHO THIS USER IS\n\n${profile.generatedSummary}`);
  }

  if (startDate) {
    sections.push(`# CALENDAR\n\nThey started the program on ${startDate}. Today is ${today}.`);
  }

  if (commitments.length > 0) {
    const active = commitments.filter((c) => c.status === "active");
    const done = commitments.filter((c) => c.status === "done");
    const lines: string[] = [];
    if (active.length) {
      lines.push("## Active commitments");
      for (const c of active) {
        lines.push(
          `- [Day ${c.day}, ${c.classification}] ${c.text}${c.rationale ? ` (${c.rationale})` : ""}`,
        );
      }
    }
    if (done.length) {
      lines.push("\n## Completed commitments");
      for (const c of done) {
        lines.push(`- [Day ${c.day}] ${c.text}`);
      }
    }
    sections.push(`# THEIR COMMITMENTS\n\n${lines.join("\n")}`);
  }

  if (memories.length > 0) {
    sections.push(
      `# SAVED MEMORIES (things they asked you to remember)\n\n${memories
        .map((m) => "- " + m.text)
        .join("\n")}`,
    );
  }

  // Day summaries + keypoints + frameworks (compact form, one block per day).
  const daySummaries = programDays
    .map(
      (
        d: {
          day: number;
          title: string;
          summary: string;
          keypoints: { title: string; body: string }[];
          frameworks: { name: string }[];
          exercise: { questions: { label: string }[] };
        },
      ) => {
        const kps = d.keypoints
          .map((k) => `- ${k.title}: ${k.body}`)
          .join("\n");
        const fws = d.frameworks.map((f) => `- ${f.name}`).join("\n") || "(none)";
        return `## Day ${d.day} — ${d.title}\n\n${d.summary}\n\nKeypoints:\n${kps}\n\nFrameworks introduced:\n${fws}`;
      },
    )
    .join("\n\n");
  sections.push(`# PROGRAM CONTENT — keypoints, frameworks, summaries\n\n${daySummaries}`);

  // Full frameworks library.
  const fwBlock = frameworks.frameworks
    .map(
      (f) =>
        `### ${f.name} (intro'd Day ${f.introduced_day})\n${f.description}\n` +
        f.steps.map((s, i) => `${i + 1}. ${s.name} — ${s.detail}`).join("\n"),
    )
    .join("\n\n");
  sections.push(`# FRAMEWORKS LIBRARY\n\n${fwBlock}`);

  // Full transcripts (load-bearing — the user explicitly wants Coach to have the actual content).
  const trBlock = transcripts
    .map((t) => `## Day ${t.day} — ${t.title}\n\n${t.text}`)
    .join("\n\n");
  sections.push(`# RAW TRANSCRIPTS (full)\n\n${trBlock}`);

  return sections.join("\n\n---\n\n");
}
