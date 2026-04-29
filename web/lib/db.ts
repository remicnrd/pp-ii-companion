import Dexie, { Table } from "dexie";
import type {
  ChatMessage,
  Commitment,
  DayProgress,
  Memory,
  MomentumSynthesis,
  Profile,
  Settings,
} from "./types";

export class AppDB extends Dexie {
  settings!: Table<Settings, "default">;
  profile!: Table<Profile, "default">;
  dayProgress!: Table<DayProgress, number>;
  commitments!: Table<Commitment, number>;
  chatMessages!: Table<ChatMessage, number>;
  memories!: Table<Memory, number>;
  synthesis!: Table<MomentumSynthesis, "default">;

  constructor() {
    super("personal-power-ii");
    this.version(1).stores({
      settings: "id",
      profile: "id",
      dayProgress: "day",
      commitments: "++id, day, status, classification, createdAt",
      chatMessages: "++id, createdAt",
      memories: "++id, createdAt",
    });
    this.version(2).stores({
      settings: "id",
      profile: "id",
      dayProgress: "day",
      commitments: "++id, day, status, classification, createdAt",
      chatMessages: "++id, createdAt",
      memories: "++id, createdAt",
      synthesis: "id",
    });
    this.version(3)
      .stores({
        settings: "id",
        profile: "id",
        dayProgress: "day",
        commitments: "++id, &key, status, classification, archivedAt, createdAt",
        chatMessages: "++id, createdAt",
        memories: "++id, createdAt",
        synthesis: "id",
      })
      .upgrade(async (tx) => {
        // Migrate existing commitments: synthesize a `key` from text, default
        // dailyChecks/sources, remap "one-time" → "once" and "ongoing" → "daily".
        await tx
          .table("commitments")
          .toCollection()
          .modify((c: Record<string, unknown>) => {
            if (!c.key) {
              const text = String(c.text ?? "untitled");
              c.key = text
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "")
                .slice(0, 60) || `legacy-${c.id ?? Date.now()}`;
            }
            if (!Array.isArray(c.dailyChecks)) c.dailyChecks = [];
            if (!Array.isArray(c.sources)) {
              c.sources = typeof c.day === "number" ? [c.day] : [];
            }
            if (c.classification === "one-time") c.classification = "once";
            if (c.classification === "ongoing") c.classification = "daily";
          });
      });
  }
}

let _db: AppDB | null = null;
export function db(): AppDB {
  if (typeof window === "undefined") {
    throw new Error("db() can only be called in the browser");
  }
  if (!_db) _db = new AppDB();
  return _db;
}

export async function getSettings(): Promise<Settings> {
  const existing = await db().settings.get("default");
  return existing ?? { id: "default" };
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = await getSettings();
  await db().settings.put({ ...current, ...patch, id: "default" });
}

export async function getProfile(): Promise<Profile | undefined> {
  return db().profile.get("default");
}

export async function saveProfile(patch: Partial<Profile>) {
  const current = (await getProfile()) ?? {
    id: "default" as const,
    rawIntake: "",
    generatedSummary: "",
    updatedAt: Date.now(),
  };
  await db().profile.put({
    ...current,
    ...patch,
    id: "default",
    updatedAt: Date.now(),
  });
}

export async function getDayProgress(day: number): Promise<DayProgress> {
  return (await db().dayProgress.get(day)) ?? { day, exerciseAnswers: {} };
}

export async function saveDayProgress(progress: DayProgress) {
  await db().dayProgress.put(progress);
}

export async function getSynthesis(): Promise<MomentumSynthesis | undefined> {
  return db().synthesis.get("default");
}

export async function saveSynthesis(text: string, commitmentCount: number) {
  await db().synthesis.put({
    id: "default",
    text,
    generatedAt: Date.now(),
    commitmentCount,
  });
}
