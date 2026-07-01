import type Database from "better-sqlite3";
import type { TaskInstance } from "@/lib/types";
import { getTemplate } from "@/lib/repositories/templates";
import { computePoints } from "@/lib/scoring";
import { addPointEntry } from "@/lib/repositories/points";
import { getScoringSettings } from "@/lib/repositories/scoringSettings";

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
  started_at: string | null;
  completed_at: string | null;
  scored_at: string | null;
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
    startedAt: r.started_at,
    completedAt: r.completed_at,
    scoredAt: r.scored_at,
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
    bonusItemIds: number[];
    errorCount: number;
    note?: string;
    now?: string;
  },
): TaskInstance {
  const task = getTask(db, taskId);
  if (!task) throw new Error("任务不存在");
  const tpl = getTemplate(db, task.templateId);
  if (!tpl) throw new Error("任务模板不存在");

  const settings = getScoringSettings(db);
  const onTimeBonus = result.actualMinutes <= tpl.defaultMinutes ? settings.onTimeBonus : 0;

  let bonusPoints = 0;
  if (result.bonusItemIds.length > 0) {
    const placeholders = result.bonusItemIds.map(() => "?").join(",");
    const row = db
      .prepare(`SELECT COALESCE(SUM(points), 0) AS s FROM bonus_items WHERE id IN (${placeholders})`)
      .get(...result.bonusItemIds) as { s: number };
    bonusPoints = row.s;
  }

  const points = computePoints({
    basePoints: tpl.basePoints,
    bonusPoints,
    onTimeBonus,
    errorCount: result.errorCount,
    errorPenalty: settings.errorPenalty,
    minPoints: settings.minPoints,
  });
  const wasScored = task.status === "scored";
  const reason = `完成任务: ${tpl.name}`;
  const now = result.now ?? new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE task_instances SET status='scored', actual_minutes=?, error_count=?, note=?, points_awarded=?, scored_at=COALESCE(scored_at, ?) WHERE id=?`,
    ).run(result.actualMinutes, result.errorCount, result.note ?? null, points, now, taskId);

    db.prepare("DELETE FROM task_bonus WHERE task_instance_id = ?").run(taskId);
    const ins = db.prepare("INSERT INTO task_bonus (task_instance_id, bonus_item_id) VALUES (?, ?)");
    for (const bid of result.bonusItemIds) ins.run(taskId, bid);

    if (wasScored) {
      db.prepare("UPDATE point_entries SET delta = ?, reason = ? WHERE task_instance_id = ?").run(points, reason, taskId);
    } else {
      addPointEntry(db, { childId: task.childId, delta: points, reason, taskInstanceId: taskId, now });
    }
  });
  tx();
  return getTask(db, taskId)!;
}

export function listTaskBonus(db: Database.Database, taskId: number): number[] {
  const rows = db
    .prepare("SELECT bonus_item_id AS bid FROM task_bonus WHERE task_instance_id = ? ORDER BY bonus_item_id")
    .all(taskId) as { bid: number }[];
  return rows.map((r) => r.bid);
}

export function startTask(
  db: Database.Database,
  taskId: number,
  now?: string,
): TaskInstance {
  const ts = now ?? new Date().toISOString();
  db.prepare(
    "UPDATE task_instances SET started_at = ?, status = 'in_progress' WHERE id = ?",
  ).run(ts, taskId);
  return getTask(db, taskId)!;
}

export function completeTask(
  db: Database.Database,
  taskId: number,
  now?: string,
): TaskInstance {
  const ts = now ?? new Date().toISOString();
  db.prepare(
    "UPDATE task_instances SET completed_at = ?, status = 'done' WHERE id = ?",
  ).run(ts, taskId);
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

export function ensureDailyTasks(
  db: Database.Database,
  childId: number,
  date: string,
): TaskInstance[] {
  const existing = listTasks(db, childId, date);
  if (existing.length > 0) return existing;
  const rows = db
    .prepare(
      `SELECT dp.template_id AS tid FROM daily_plan dp
       JOIN task_templates t ON t.id = dp.template_id
       WHERE dp.child_id = ? AND t.archived = 0
       ORDER BY dp.id`,
    )
    .all(childId) as { tid: number }[];
  for (const r of rows) {
    assignTask(db, { childId, templateId: r.tid, date });
  }
  return listTasks(db, childId, date);
}
