import type Database from "better-sqlite3";
import type { Subject, TaskTemplate } from "@/lib/types";

interface Row {
  id: number;
  name: string;
  subject: Subject;
  default_minutes: number;
  base_points: number;
}

function toTemplate(r: Row): TaskTemplate {
  return {
    id: r.id,
    name: r.name,
    subject: r.subject,
    defaultMinutes: r.default_minutes,
    basePoints: r.base_points,
  };
}

export function createTemplate(
  db: Database.Database,
  input: { name: string; subject: Subject; defaultMinutes: number; basePoints: number },
): TaskTemplate {
  const info = db
    .prepare(
      "INSERT INTO task_templates (name, subject, default_minutes, base_points) VALUES (?, ?, ?, ?)",
    )
    .run(input.name, input.subject, input.defaultMinutes, input.basePoints);
  return getTemplate(db, Number(info.lastInsertRowid))!;
}

export function listTemplates(db: Database.Database): TaskTemplate[] {
  const rows = db.prepare("SELECT * FROM task_templates ORDER BY id").all() as Row[];
  return rows.map(toTemplate);
}

export function getTemplate(
  db: Database.Database,
  id: number,
): TaskTemplate | undefined {
  const r = db.prepare("SELECT * FROM task_templates WHERE id = ?").get(id) as
    | Row
    | undefined;
  return r ? toTemplate(r) : undefined;
}
