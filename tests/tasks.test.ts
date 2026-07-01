import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask, listTasks, scoreTask } from "@/lib/repositories/tasks";
import { getBalance, listEntries } from "@/lib/repositories/points";

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

test("scoring writes points and updates status", () => {
  const { db, child, tpl } = setup();
  const t = assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-06-29" });
  const scored = scoreTask(db, t.id, {
    actualMinutes: 6,
    focused: true,
    usedScaffold: false,
    didCheck: false,
    errorCount: 0,
  });
  expect(scored.status).toBe("scored");
  expect(scored.pointsAwarded).toBe(15); // 10 base + 5 focus
  expect(getBalance(db, child.id)).toBe(15);
});

test("re-scoring updates points and balance without adding a new entry", () => {
  const { db, child, tpl } = setup();
  const t = assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-06-29" });

  // first score: base 10
  scoreTask(db, t.id, { actualMinutes: 5, focused: false, usedScaffold: false, didCheck: false, errorCount: 0 });
  expect(getBalance(db, child.id)).toBe(10);
  const entryCountBefore = listEntries(db, child.id).length;

  // re-score: base 10 + focus 5 = 15
  const updated = scoreTask(db, t.id, { actualMinutes: 6, focused: true, usedScaffold: false, didCheck: false, errorCount: 0 });
  expect(updated.status).toBe("scored");
  expect(updated.pointsAwarded).toBe(15);
  expect(getBalance(db, child.id)).toBe(15);
  expect(listEntries(db, child.id).length).toBe(entryCountBefore); // no new entry added
});

test("scoreTask records scored_at on first score and preserves it on re-score", () => {
  const { db, child, tpl } = setup();
  const t = assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-07-01" });
  const first = scoreTask(db, t.id, { actualMinutes: 5, focused: false, usedScaffold: false, didCheck: false, errorCount: 0, now: "2026-07-01T09:00:00.000Z" });
  expect(first.scoredAt).toBe("2026-07-01T09:00:00.000Z");
  const again = scoreTask(db, t.id, { actualMinutes: 6, focused: true, usedScaffold: false, didCheck: false, errorCount: 0, now: "2026-07-01T10:00:00.000Z" });
  expect(again.scoredAt).toBe("2026-07-01T09:00:00.000Z"); // preserved
  expect(again.pointsAwarded).toBe(15); // re-score still updates points
});
