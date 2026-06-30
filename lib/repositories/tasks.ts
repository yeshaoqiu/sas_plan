import type Database from "better-sqlite3";
import type { TaskInstance } from "@/lib/types";
import { getTemplate } from "@/lib/repositories/templates";
import { computePoints } from "@/lib/scoring";
import { addPointEntry } from "@/lib/repositories/points";

interface Row {
  id: number;
  child_id: number;
  template_id: number;
  date: string;
  status: TaskInstance["status"];
  actual_minutes: number | null;
  focused: number | null;
  used_scaffold: number | null;
  did_check: number | null;
  error_count: number | null;
  note: string | null;
  points_awarded: number | null;
}

function toTask(r: Row): TaskInstance {
  return {
    id: r.id,
    childId: r.child_id,
    templateId: r.template_id,
    date: r.date,
    status: r.status,
    actualMinutes: r.actual_minutes,
    focused: r.focused,
    usedScaffold: r.used_scaffold,
    didCheck: r.did_check,
    errorCount: r.error_count,
    note: r.note,
    pointsAwarded: r.points_awarded,
  };
}

function getTask(db: Database.Database, id: number): TaskInstance | undefined {
  const r = db.prepare("SELECT * FROM task_instances WHERE id = ?").get(id) as
    | Row
    | undefined;
  return r ? toTask(r) : undefined;
}

export function assignTask(
  db: Database.Database,
  input: { childId: number; templateId: number; date: string },
): TaskInstance {
  const info = db
    .prepare(
      "INSERT INTO task_instances (child_id, template_id, date, status) VALUES (?, ?, ?, 'pending')",
    )
    .run(input.childId, input.templateId, input.date);
  return getTask(db, Number(info.lastInsertRowid))!;
}

export function listTasks(
  db: Database.Database,
  childId: number,
  date: string,
): TaskInstance[] {
  const rows = db
    .prepare("SELECT * FROM task_instances WHERE child_id = ? AND date = ? ORDER BY id")
    .all(childId, date) as Row[];
  return rows.map(toTask);
}

export function scoreTask(
  db: Database.Database,
  taskId: number,
  result: {
    actualMinutes: number;
    focused: boolean;
    usedScaffold: boolean;
    didCheck: boolean;
    errorCount: number;
    note?: string;
    now?: string;
  },
): TaskInstance {
  const task = getTask(db, taskId);
  if (!task) throw new Error("任务不存在");
  if (task.status === "scored") throw new Error("任务已评分");
  const tpl = getTemplate(db, task.templateId);
  if (!tpl) throw new Error("任务模板不存在");

  const points = computePoints({
    basePoints: tpl.basePoints,
    focused: result.focused,
    usedScaffold: result.usedScaffold,
    didCheck: result.didCheck,
    errorCount: result.errorCount,
  });

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE task_instances SET status='scored', actual_minutes=?, focused=?, used_scaffold=?, did_check=?, error_count=?, note=?, points_awarded=? WHERE id=?`,
    ).run(
      result.actualMinutes,
      result.focused ? 1 : 0,
      result.usedScaffold ? 1 : 0,
      result.didCheck ? 1 : 0,
      result.errorCount,
      result.note ?? null,
      points,
      taskId,
    );
    addPointEntry(db, {
      childId: task.childId,
      delta: points,
      reason: `完成任务: ${tpl.name}`,
      taskInstanceId: taskId,
      now: result.now,
    });
  });
  tx();
  return getTask(db, taskId)!;
}

export function getDayProgress(
  db: Database.Database,
  childId: number,
  date: string,
): { total: number; scored: number; pointsEarned: number } {
  const total = (
    db
      .prepare("SELECT COUNT(*) AS n FROM task_instances WHERE child_id = ? AND date = ?")
      .get(childId, date) as { n: number }
  ).n;
  const scored = (
    db
      .prepare("SELECT COUNT(*) AS n FROM task_instances WHERE child_id = ? AND date = ? AND status = 'scored'")
      .get(childId, date) as { n: number }
  ).n;
  const pointsEarned = (
    db
      .prepare("SELECT COALESCE(SUM(points_awarded), 0) AS s FROM task_instances WHERE child_id = ? AND date = ? AND status = 'scored'")
      .get(childId, date) as { s: number }
  ).s;
  return { total, scored, pointsEarned };
}
