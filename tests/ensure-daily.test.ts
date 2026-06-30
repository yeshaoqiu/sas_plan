import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate, archiveTemplate } from "@/lib/repositories/templates";
import { addToDailyPlan } from "@/lib/repositories/dailyPlan";
import { ensureDailyTasks, listTasks, assignTask } from "@/lib/repositories/tasks";

function setup() {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const t1 = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  const t2 = createTemplate(db, { name: "口算", subject: "math", defaultMinutes: 8, basePoints: 10 });
  return { db, c, t1, t2 };
}

test("creates one task per active plan template when day is empty", () => {
  const { db, c, t1, t2 } = setup();
  addToDailyPlan(db, c.id, t1.id);
  addToDailyPlan(db, c.id, t2.id);
  const created = ensureDailyTasks(db, c.id, "2026-07-01");
  expect(created).toHaveLength(2);
  expect(listTasks(db, c.id, "2026-07-01")).toHaveLength(2);
});

test("idempotent: does nothing if day already has tasks", () => {
  const { db, c, t1, t2 } = setup();
  addToDailyPlan(db, c.id, t1.id);
  assignTask(db, { childId: c.id, templateId: t2.id, date: "2026-07-01" }); // pre-existing
  const result = ensureDailyTasks(db, c.id, "2026-07-01");
  expect(result).toHaveLength(1); // unchanged, not 1+1
  expect(listTasks(db, c.id, "2026-07-01")).toHaveLength(1);
});

test("skips archived templates; empty plan creates nothing", () => {
  const { db, c, t1, t2 } = setup();
  addToDailyPlan(db, c.id, t1.id);
  addToDailyPlan(db, c.id, t2.id);
  archiveTemplate(db, t2.id);
  expect(ensureDailyTasks(db, c.id, "2026-07-01")).toHaveLength(1); // only t1

  const c2 = createChild(db, { name: "小红", grade: 2 });
  expect(ensureDailyTasks(db, c2.id, "2026-07-01")).toHaveLength(0); // no plan
});
