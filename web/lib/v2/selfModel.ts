export function todayISO(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
