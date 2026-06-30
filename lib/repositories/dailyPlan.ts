import type Database from "better-sqlite3";

export function listDailyPlan(db: Database.Database, childId: number): number[] {
  const rows = db
    .prepare("SELECT template_id AS tid FROM daily_plan WHERE child_id = ? ORDER BY id")
    .all(childId) as { tid: number }[];
  return rows.map((r) => r.tid);
}

export function addToDailyPlan(
  db: Database.Database,
  childId: number,
  templateId: number,
): void {
  const exists = db
    .prepare("SELECT 1 FROM daily_plan WHERE child_id = ? AND template_id = ?")
    .get(childId, templateId);
  if (!exists) {
    db.prepare("INSERT INTO daily_plan (child_id, template_id) VALUES (?, ?)").run(
      childId,
      templateId,
    );
  }
}

export function removeFromDailyPlan(
  db: Database.Database,
  childId: number,
  templateId: number,
): void {
  db.prepare("DELETE FROM daily_plan WHERE child_id = ? AND template_id = ?").run(
    childId,
    templateId,
  );
}
