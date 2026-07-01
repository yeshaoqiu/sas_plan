import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask, listTasks, scoreTask, listTaskBonus } from "@/lib/repositories/tasks";
import { getBalance, listEntries } from "@/lib/repositories/points";
import { listBonusItems } from "@/lib/repositories/bonusItems";

function setup() {
  const db = createDb(":memory:");
  const child = createChild(db, { name: "小明", grade: 1 });
  const tpl = createTemplate(db, {
    name: "认真写 5 个字",
    subject: "writing",
    defaultMinutes: 5,
    basePoints: 10,
  });
  return { db, child, tpl };
}

test("assign then list", () => {
  const { db, child, tpl } = setup();
  assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-06-29" });
  const tasks = listTasks(db, child.id, "2026-06-29");
  expect(tasks).toHaveLength(1);
  expect(tasks[0].status).toBe("pending");
});

test("scores with base + selected bonus + on-time; writes points and task_bonus", () => {
  const { db, child, tpl } = setup();
  const items = listBonusItems(db); // 3 seeded, each +5
  const t = assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-07-01" });
  // actualMinutes 5 <= defaultMinutes 5 → on-time (+3); pick first bonus (+5); base 10 = 18
  const scored = scoreTask(db, t.id, { actualMinutes: 5, bonusItemIds: [items[0].id], errorCount: 0 });
  expect(scored.status).toBe("scored");
  expect(scored.pointsAwarded).toBe(18);
  expect(getBalance(db, child.id)).toBe(18);
  expect(listTaskBonus(db, t.id)).toEqual([items[0].id]);
});

test("no on-time bonus when over time; errors subtract", () => {
  const { db, child, tpl } = setup();
  const t = assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-07-01" });
  // actualMinutes 9 > 5 → no on-time; no bonus; 2 errors * 2 = -4; base 10 → 6
  const scored = scoreTask(db, t.id, { actualMinutes: 9, bonusItemIds: [], errorCount: 2 });
  expect(scored.pointsAwarded).toBe(6);
});

test("re-scoring updates points and task_bonus without adding a new entry; scored_at preserved", () => {
  const { db, child, tpl } = setup();
  const items = listBonusItems(db);
  const t = assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-07-01" });
  scoreTask(db, t.id, { actualMinutes: 9, bonusItemIds: [], errorCount: 0, now: "2026-07-01T09:00:00.000Z" }); // base 10
  expect(getBalance(db, child.id)).toBe(10);
  const before = listEntries(db, child.id).length;
  const again = scoreTask(db, t.id, { actualMinutes: 5, bonusItemIds: [items[0].id, items[1].id], errorCount: 0, now: "2026-07-01T10:00:00.000Z" });
  // on-time (+3) + two bonuses (+10) + base 10 = 23
  expect(again.pointsAwarded).toBe(23);
  expect(again.scoredAt).toBe("2026-07-01T09:00:00.000Z"); // preserved
  expect(getBalance(db, child.id)).toBe(23);
  expect(listEntries(db, child.id).length).toBe(before); // no new entry
  expect(listTaskBonus(db, t.id).sort()).toEqual([items[0].id, items[1].id].sort());
});
