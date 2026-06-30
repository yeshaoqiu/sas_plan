import { expect, test } from "vitest";
import Database from "better-sqlite3";
import { createDb, runMigrations } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask } from "@/lib/repositories/tasks";

test("new task has null timestamps via toTask", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const t = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  const task = assignTask(db, { childId: c.id, templateId: t.id, date: "2026-07-01" });
  expect(task.startedAt).toBeNull();
  expect(task.completedAt).toBeNull();
  expect(task.scoredAt).toBeNull();
});

test("migration adds the three columns to a legacy task_instances", () => {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE children (id INTEGER PRIMARY KEY)");
  db.exec("CREATE TABLE task_templates (id INTEGER PRIMARY KEY)");
  db.exec(
    "CREATE TABLE task_instances (id INTEGER PRIMARY KEY, child_id INTEGER, template_id INTEGER, date TEXT, status TEXT, actual_minutes INTEGER, focused INTEGER, used_scaffold INTEGER, did_check INTEGER, error_count INTEGER, note TEXT, points_awarded INTEGER)",
  );
  runMigrations(db);
  runMigrations(db); // idempotent
  const cols = (db.prepare("PRAGMA table_info(task_instances)").all() as { name: string }[]).map((c) => c.name);
  expect(cols).toContain("started_at");
  expect(cols).toContain("completed_at");
  expect(cols).toContain("scored_at");
});

test("daily_plan has a unique index on (child_id, template_id)", () => {
  const db = createDb(":memory:");
  const idx = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_daily_plan_child_template'")
    .get() as { name: string } | undefined;
  expect(idx?.name).toBe("idx_daily_plan_child_template");
});
