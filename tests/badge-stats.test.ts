import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { listBonusItems } from "@/lib/repositories/bonusItems";
import { assignTask, scoreTask } from "@/lib/repositories/tasks";
import { getBadgeStats } from "@/lib/repositories/growth";

function setup() {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const items = listBonusItems(db); // seed: 专注完成 / 用上支架 / 做了检查
  const focus = items.find((i) => i.name.includes("专注"))!;
  const check = items.find((i) => i.name.includes("检查"))!;
  return { db, c, focus, check };
}

function scoreWith(
  db: ReturnType<typeof createDb>,
  childId: number,
  date: string,
  bonusItemIds: number[],
) {
  const tpl = createTemplate(db, { name: `任务${date}`, subject: "writing", defaultMinutes: 5, basePoints: 10 });
  const t = assignTask(db, { childId, templateId: tpl.id, date });
  scoreTask(db, t.id, { actualMinutes: 5, bonusItemIds, errorCount: 0 });
}

test("focusedCount counts tasks tagged with 专注 bonus", () => {
  const { db, c, focus, check } = setup();
  scoreWith(db, c.id, "2026-07-01", [focus.id]);
  scoreWith(db, c.id, "2026-07-02", [focus.id, check.id]);
  scoreWith(db, c.id, "2026-07-03", [check.id]); // 只检查，不算专注

  const stats = getBadgeStats(db, c.id);
  expect(stats.scoredCount).toBe(3);
  expect(stats.focusedCount).toBe(2);
  expect(stats.checkedCount).toBe(2);
});

test("no focus/check bonus → zero", () => {
  const { db, c } = setup();
  scoreWith(db, c.id, "2026-07-01", []);
  const stats = getBadgeStats(db, c.id);
  expect(stats.scoredCount).toBe(1);
  expect(stats.focusedCount).toBe(0);
  expect(stats.checkedCount).toBe(0);
});
