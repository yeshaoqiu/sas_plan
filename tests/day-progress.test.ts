import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask, scoreTask, getDayProgress } from "@/lib/repositories/tasks";

test("getDayProgress counts total/scored and sums points for the day", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const tpl = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  const t1 = assignTask(db, { childId: c.id, templateId: tpl.id, date: "2026-06-30" });
  assignTask(db, { childId: c.id, templateId: tpl.id, date: "2026-06-30" }); // unscored
  assignTask(db, { childId: c.id, templateId: tpl.id, date: "2026-06-29" }); // other day

  scoreTask(db, t1.id, { actualMinutes: 5, bonusItemIds: [], errorCount: 0 }); // base 10 + on-time 3 = 13

  const p = getDayProgress(db, c.id, "2026-06-30");
  expect(p.total).toBe(2);
  expect(p.scored).toBe(1);
  expect(p.pointsEarned).toBe(13);
});

test("getDayProgress is zero for a day with no tasks", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  expect(getDayProgress(db, c.id, "2026-06-30")).toEqual({ total: 0, scored: 0, pointsEarned: 0 });
});
