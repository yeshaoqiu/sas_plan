import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { listDailyPlan, addToDailyPlan, removeFromDailyPlan } from "@/lib/repositories/dailyPlan";

function setup() {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const t1 = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  const t2 = createTemplate(db, { name: "口算", subject: "math", defaultMinutes: 8, basePoints: 10 });
  return { db, c, t1, t2 };
}

test("add/list/remove daily plan; add is idempotent", () => {
  const { db, c, t1, t2 } = setup();
  expect(listDailyPlan(db, c.id)).toEqual([]);
  addToDailyPlan(db, c.id, t1.id);
  addToDailyPlan(db, c.id, t2.id);
  addToDailyPlan(db, c.id, t1.id); // duplicate ignored
  expect(listDailyPlan(db, c.id)).toEqual([t1.id, t2.id]);
  removeFromDailyPlan(db, c.id, t1.id);
  expect(listDailyPlan(db, c.id)).toEqual([t2.id]);
});
