import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask, scoreTask } from "@/lib/repositories/tasks";
import { grantStreakRewards } from "@/lib/repositories/growth";
import { getBalance } from "@/lib/repositories/points";

function setup() {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const tpl = createTemplate(db, {
    name: "写字",
    subject: "writing",
    defaultMinutes: 5,
    basePoints: 10,
  });
  return { db, c, tpl };
}

function scoredOn(
  db: ReturnType<typeof createDb>,
  childId: number,
  tplId: number,
  date: string,
) {
  const t = assignTask(db, { childId, templateId: tplId, date });
  scoreTask(db, t.id, { actualMinutes: 5, bonusItemIds: [], errorCount: 0 });
}

test("grants 3-day milestone once and is idempotent", () => {
  const { db, c, tpl } = setup();
  scoredOn(db, c.id, tpl.id, "2026-06-29");
  scoredOn(db, c.id, tpl.id, "2026-06-30");
  scoredOn(db, c.id, tpl.id, "2026-07-01");

  const balBefore = getBalance(db, c.id);
  const first = grantStreakRewards(db, c.id, "2026-07-01");
  expect(first.map((m) => m.days)).toEqual([3]);
  expect(getBalance(db, c.id)).toBe(balBefore + 5);

  // 再次调用同一天，不应重复发放
  const second = grantStreakRewards(db, c.id, "2026-07-01");
  expect(second).toEqual([]);
  expect(getBalance(db, c.id)).toBe(balBefore + 5);
});

test("no milestone before 3 consecutive days", () => {
  const { db, c, tpl } = setup();
  scoredOn(db, c.id, tpl.id, "2026-06-30");
  scoredOn(db, c.id, tpl.id, "2026-07-01");
  expect(grantStreakRewards(db, c.id, "2026-07-01")).toEqual([]);
});
