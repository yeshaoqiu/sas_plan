import type { DB } from "@/lib/sqlite-compat";
import type { Subject, TaskTemplate } from "@/lib/types";

interface Row {
  id: number;
  name: string;
  subject: Subject;
  default_minutes: number;
  base_points: number;
  archived: number;
}

function toTemplate(r: Row): TaskTemplate {
  return {
    id: r.id,
    name: r.name,
    subject: r.subject,
    defaultMinutes: r.default_minutes,
    basePoints: r.base_points,
    archived: r.archived,
  };
}

export function createTemplate(
  db: DB,
  input: { name: string; subject: Subject; defaultMinutes: number; basePoints: number },
): TaskTemplate {
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("请填写任务名");
  const info = db
    .prepare(
      "INSERT INTO task_templates (name, subject, default_minutes, base_points) VALUES (?, ?, ?, ?)",
    )
    .run(name, input.subject, input.defaultMinutes, input.basePoints);
  return getTemplate(db, Number(info.lastInsertRowid))!;
}

export function updateTemplate(
  db: DB,
  id: number,
  input: { name: string; subject: Subject; defaultMinutes: number; basePoints: number },
): TaskTemplate {
  db.prepare(
    "UPDATE task_templates SET name = ?, subject = ?, default_minutes = ?, base_points = ? WHERE id = ?",
  ).run(input.name, input.subject, input.defaultMinutes, input.basePoints, id);
  return getTemplate(db, id)!;
}

export function archiveTemplate(db: DB, id: number): void {
  db.prepare("UPDATE task_templates SET archived = 1 WHERE id = ?").run(id);
}

export function restoreTemplate(db: DB, id: number): void {
  db.prepare("UPDATE task_templates SET archived = 0 WHERE id = ?").run(id);
}

export function listTemplates(db: DB): TaskTemplate[] {
  const rows = db
    .prepare("SELECT * FROM task_templates WHERE archived = 0 ORDER BY id")
    .all() as Row[];
  return rows.map(toTemplate);
}

export function listAllTemplates(db: DB): TaskTemplate[] {
  const rows = db
    .prepare("SELECT * FROM task_templates ORDER BY archived, id")
    .all() as Row[];
  return rows.map(toTemplate);
}

export function getTemplate(
  db: DB,
  id: number,
): TaskTemplate | undefined {
  const r = db.prepare("SELECT * FROM task_templates WHERE id = ?").get(id) as
    | Row
    | undefined;
  return r ? toTemplate(r) : undefined;
}
