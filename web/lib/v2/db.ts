import Dexie, { Table } from "dexie";
import type {
  Belief,
  CoachMessageV2,
  CoreValue,
  DayProgressV2,
  PrimingEntry,
  Thermostat,
  V2Settings,
} from "./types";

/**
 * v2 lives in its OWN IndexedDB database. The v1 app ("personal-power-ii")
 * is never opened for writes here, so nothing the user already has is at risk.
 * The only cross-over is an optional one-time, read-only import of the API key
 * (see importKeyFromV1).
 */
export class V2DB extends Dexie {
  settings!: Table<V2Settings, "default">;
  beliefs!: Table<Belief, number>;
  thermostat!: Table<Thermostat, string>; // keyed by domain
  values!: Table<CoreValue, number>;
  priming!: Table<PrimingEntry, string>; // keyed by date
  dayProgress!: Table<DayProgressV2, number>;
  coachMessages!: Table<CoachMessageV2, number>;

  constructor() {
    super("personal-power-ii-v2");
    this.version(1).stores({
      settings: "id",
      beliefs: "++id, domain, state, archivedAt, createdAt",
      thermostat: "domain",
      values: "++id, rank, createdAt",
      priming: "date",
      dayProgress: "day",
      coachMessages: "++id, createdAt",
    });
  }
}

let _db: V2DB | null = null;
export function vdb(): V2DB {
  if (typeof window === "undefined") {
    throw new Error("vdb() can only be called in the browser");
  }
  if (!_db) _db = new V2DB();
  return _db;
}

// ---------- settings ----------
export async function getV2Settings(): Promise<V2Settings> {
  const existing = await vdb().settings.get("default");
  return existing ?? { id: "default" };
}
export async function saveV2Settings(patch: Partial<V2Settings>) {
  const current = await getV2Settings();
  await vdb().settings.put({ ...current, ...patch, id: "default" });
}

/**
 * Pull the API key/base/model the user already set in the v1 app.
 *
 * v1 and v2 are the same origin, so v1's IndexedDB is readable from here. We try
 * the known v1 database name first, then fall back to scanning every IndexedDB
 * database in this origin for a `settings` table with an `apiKey` — so it works
 * even if the v1 db name ever differed. Read-only: nothing in v1 is modified.
 */
export async function importKeyFromV1(): Promise<boolean> {
  const apply = (s: { apiKey?: string; baseURL?: string; model?: string } | undefined) => {
    if (s?.apiKey) {
      return saveV2Settings({ apiKey: s.apiKey, baseURL: s.baseURL, model: s.model }).then(() => true);
    }
    return Promise.resolve(false);
  };

  const tryDb = async (name: string): Promise<boolean> => {
    if (name === "personal-power-ii-v2") return false;
    let dbx: Dexie | null = null;
    try {
      dbx = await new Dexie(name).open();
      if (!dbx.tables.some((t) => t.name === "settings")) return false;
      const s = await dbx.table("settings").get("default");
      return await apply(s as { apiKey?: string } | undefined);
    } catch {
      return false;
    } finally {
      dbx?.close();
    }
  };

  // 1. Known v1 name.
  if (await tryDb("personal-power-ii")) return true;

  // 2. Scan everything else in this origin.
  try {
    const list = (await indexedDB.databases?.()) ?? [];
    for (const info of list) {
      if (info.name && (await tryDb(info.name))) return true;
    }
  } catch {
    /* indexedDB.databases() unsupported — the known-name attempt above is the fallback */
  }
  return false;
}

// ---------- day progress ----------
export async function getDayProgressV2(day: number): Promise<DayProgressV2> {
  return (
    (await vdb().dayProgress.get(day)) ?? {
      day,
      nac: {},
      updatedAt: Date.now(),
    }
  );
}
export async function saveDayProgressV2(p: DayProgressV2) {
  await vdb().dayProgress.put({ ...p, updatedAt: Date.now() });
}

// ---------- beliefs ----------
export async function addBelief(b: Omit<Belief, "id" | "createdAt" | "updatedAt">) {
  const now = Date.now();
  return vdb().beliefs.add({ ...b, createdAt: now, updatedAt: now });
}
export async function updateBelief(id: number, patch: Partial<Belief>) {
  await vdb().beliefs.update(id, { ...patch, updatedAt: Date.now() });
}

// ---------- thermostat ----------
export async function setThermostat(domain: Thermostat["domain"], level: number, note?: string) {
  await vdb().thermostat.put({ domain, level, note, updatedAt: Date.now() });
}

// ---------- priming ----------
export async function getPriming(date: string): Promise<PrimingEntry | undefined> {
  return vdb().priming.get(date);
}
export async function savePriming(entry: PrimingEntry) {
  await vdb().priming.put(entry);
}
