import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { listBonusItems } from "@/lib/repositories/bonusItems";
import { assignTask, listTasks, scoreTask } from "@/lib/repositories/tasks";

test("listTasks attaches bonusItemIds (empty when unscored, populated after scoring)", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const tpl = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  const items = listBonusItems(db);
  const t = assignTask(db, { childId: c.id, templateId: tpl.id, date: "2026-07-01" });

  expect(listTasks(db, c.id, "2026-07-01")[0].bonusItemIds).toEqual([]);

  scoreTask(db, t.id, { actualMinutes: 5, bonusItemIds: [items[0].id, items[1].id], errorCount: 0 });
  const scored = listTasks(db, c.id, "2026-07-01")[0];
  expect(scored.bonusItemIds.slice().sort()).toEqual([items[0].id, items[1].id].slice().sort());
});
