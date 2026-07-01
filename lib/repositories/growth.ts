import type Database from "better-sqlite3";

function prevDay(date: string): string {
  const dt = new Date(date + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function getStreak(
  db: Database.Database,
  childId: number,
  today: string,
): number {
  const rows = db
    .prepare(
      "SELECT DISTINCT date FROM task_instances WHERE child_id = ? AND status = 'scored'",
    )
    .all(childId) as { date: string }[];
  const days = new Set(rows.map((r) => r.date));

  const yesterday = prevDay(today);
  let anchor: string | null = null;
  if (days.has(today)) anchor = today;
  else if (days.has(yesterday)) anchor = yesterday;
  if (anchor === null) return 0;

  let count = 0;
  let d: string = anchor;
  while (days.has(d)) {
    count++;
    d = prevDay(d);
  }
  return count;
}
