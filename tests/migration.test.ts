import { expect, test } from "vitest";
import Database from "better-sqlite3";
import { createDb, runMigrations } from "@/lib/db";

test("fresh db: children & task_templates have archived defaulting 0", () => {
  const db = createDb(":memory:");
  const c = db.prepare("INSERT INTO children (name, grade) VALUES ('小明', 1)").run();
  const row = db.prepare("SELECT archived FROM children WHERE id = ?").get(c.lastInsertRowid) as { archived: number };
  expect(row.archived).toBe(0);
});

test("runMigrations adds archived to legacy tables lacking it (idempotent)", () => {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE children (id INTEGER PRIMARY KEY, name TEXT, grade INTEGER)");
  db.exec("CREATE TABLE task_templates (id INTEGER PRIMARY KEY, name TEXT, subject TEXT, default_minutes INTEGER, base_points INTEGER)");
  runMigrations(db);
  runMigrations(db); // second call must not throw
  const cols = db.prepare("PRAGMA table_info(children)").all() as { name: string }[];
  const tcols = db.prepare("PRAGMA table_info(task_templates)").all() as { name: string }[];
  expect(cols.some((c) => c.name === "archived")).toBe(true);
  expect(tcols.some((c) => c.name === "archived")).toBe(true);
});
