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
