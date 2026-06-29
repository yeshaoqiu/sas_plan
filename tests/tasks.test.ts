import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask, listTasks, scoreTask } from "@/lib/repositories/tasks";
import { getBalance } from "@/lib/repositories/points";

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

test("cannot score twice", () => {
  const { db, child, tpl } = setup();
  const t = assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-06-29" });
  scoreTask(db, t.id, { actualMinutes: 5, focused: false, usedScaffold: false, didCheck: false, errorCount: 0 });
  expect(() =>
    scoreTask(db, t.id, { actualMinutes: 5, focused: false, usedScaffold: false, didCheck: false, errorCount: 0 }),
  ).toThrow("任务已评分");
});
