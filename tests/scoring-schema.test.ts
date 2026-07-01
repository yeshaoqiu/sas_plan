import { expect, test } from "vitest";
import { createDb, seedDefaults } from "@/lib/db";

test("seeds three default bonus items with descriptions and points", () => {
  const db = createDb(":memory:");
  const rows = db.prepare("SELECT name, points, description FROM bonus_items ORDER BY sort_order").all() as { name: string; points: number; description: string }[];
  expect(rows.map((r) => r.name)).toEqual(["专注完成", "用上支架", "做了检查"]);
  expect(rows.every((r) => r.points === 5)).toBe(true);
  expect(rows.every((r) => r.description.length > 0)).toBe(true);
});

test("seeds default scoring_settings row", () => {
  const db = createDb(":memory:");
  const s = db.prepare("SELECT on_time_bonus, error_penalty, min_points FROM scoring_settings WHERE id = 1").get() as { on_time_bonus: number; error_penalty: number; min_points: number };
  expect(s).toEqual({ on_time_bonus: 3, error_penalty: 2, min_points: 1 });
});

test("seedDefaults is idempotent", () => {
  const db = createDb(":memory:");
  seedDefaults(db);
  seedDefaults(db);
  const n = (db.prepare("SELECT COUNT(*) AS n FROM bonus_items").get() as { n: number }).n;
  expect(n).toBe(3);
});

test("task_bonus unique index exists", () => {
  const db = createDb(":memory:");
  const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_task_bonus'").get() as { name: string } | undefined;
  expect(idx?.name).toBe("idx_task_bonus");
});
