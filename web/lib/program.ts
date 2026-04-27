import type {
  DaysIndex,
  FrameworksIndex,
  ProgramDay,
  ProgramDayMeta,
} from "./types";
import { withBasePath } from "./url";

let _daysIndex: DaysIndex | null = null;
let _frameworks: FrameworksIndex | null = null;
const _dayCache = new Map<number, ProgramDay>();
const _transcriptCache = new Map<number, string>();

export async function loadDaysIndex(): Promise<DaysIndex> {
  if (_daysIndex) return _daysIndex;
  const res = await fetch(withBasePath("/program-data/days.json"));
  if (!res.ok) throw new Error("failed to load days.json");
  _daysIndex = await res.json();
  return _daysIndex!;
}

export async function loadFrameworks(): Promise<FrameworksIndex> {
  if (_frameworks) return _frameworks;
  const res = await fetch(withBasePath("/program-data/frameworks.json"));
  if (!res.ok) throw new Error("failed to load frameworks.json");
  _frameworks = await res.json();
  return _frameworks!;
}

export async function loadDay(day: number): Promise<ProgramDay> {
  const cached = _dayCache.get(day);
  if (cached) return cached;
  const padded = day.toString().padStart(2, "0");
  const res = await fetch(withBasePath(`/program-data/day-${padded}.json`));
  if (!res.ok) throw new Error(`failed to load day-${padded}.json`);
  const json: ProgramDay = await res.json();
  _dayCache.set(day, json);
  return json;
}

export async function loadTranscript(day: number): Promise<string> {
  const cached = _transcriptCache.get(day);
  if (cached) return cached;
  const index = await loadDaysIndex();
  const meta = index.days.find((d) => d.day === day);
  if (!meta?.transcript_file) return "";
  const res = await fetch(withBasePath("/" + meta.transcript_file));
  if (!res.ok) return "";
  const text = await res.text();
  _transcriptCache.set(day, text);
  return text;
}

export function audioUrlForDay(meta: ProgramDayMeta): string | null {
  if (!meta.audio_file) return null;
  return withBasePath("/" + meta.audio_file);
}

/** First day not marked completed. If all are completed, returns the last day. */
export function nextUnfinishedDay(
  completedDayNumbers: Set<number>,
  total = 20,
): number {
  for (let i = 1; i <= total; i++) {
    if (!completedDayNumbers.has(i)) return i;
  }
  return total;
}

export function expectedDayOnDate(startDate: string, today = new Date()): number {
  const start = new Date(startDate + "T00:00:00");
  const ms = today.getTime() - start.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  // Tony's program is 30 days; multi-day blocks (5-7, 12-14, 19-21, 26-30)
  // map to single audio sessions. Map calendar day → audio index.
  // calendar day 1 → audio 1; day 5 → audio 5 (covers calendar 5-7); day 8 → audio 6; etc.
  const calendarDay = Math.max(1, Math.min(30, days + 1));
  const map: Record<number, number> = {};
  // Day-by-day map using the covers arrays would be more correct; quick build:
  const coversToAudio: [number[], number][] = [
    [[1], 1], [[2], 2], [[3], 3], [[4], 4],
    [[5, 6, 7], 5],
    [[8], 6], [[9], 7], [[10], 8], [[11], 9],
    [[12, 13, 14], 10],
    [[15], 11], [[16], 12], [[17], 13], [[18], 14],
    [[19, 20, 21], 15],
    [[22], 16], [[23], 17], [[24], 18], [[25], 19],
    [[26, 27, 28, 29, 30], 20],
  ];
  for (const [calendar, audio] of coversToAudio) {
    for (const c of calendar) map[c] = audio;
  }
  return map[calendarDay] ?? 1;
}
