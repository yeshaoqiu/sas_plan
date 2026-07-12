import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask, scoreTask } from "@/lib/repositories/tasks";
import { spinDaily, getSpinStatus } from "@/lib/repositories/growth";
import { getBalance } from "@/lib/repositories/points";

function setup() {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const tpl = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  return { db, c, tpl };
}

test("locked until all tasks scored", () => {
  const { db, c, tpl } = setup();
  const tpl2 = createTemplate(db, { name: "阅读", subject: "other", defaultMinutes: 5, basePoints: 10 });
  const t1 = assignTask(db, { childId: c.id, templateId: tpl.id, date: "2026-07-01" });
  assignTask(db, { childId: c.id, templateId: tpl2.id, date: "2026-07-01" }); // second task unscored
  scoreTask(db, t1.id, { actualMinutes: 5, bonusItemIds: [], errorCount: 0 });

  expect(getSpinStatus(db, c.id, "2026-07-01").unlocked).toBe(false);
  const r = spinDaily(db, c.id, "2026-07-01", 0);
  expect(r.ok).toBe(false);
});

test("spins once, awards prize, idempotent per day", () => {
  const { db, c, tpl } = setup();
  const t = assignTask(db, { childId: c.id, templateId: tpl.id, date: "2026-07-01" });
  scoreTask(db, t.id, { actualMinutes: 5, bonusItemIds: [], errorCount: 0 });

  expect(getSpinStatus(db, c.id, "2026-07-01").unlocked).toBe(true);
  const bal = getBalance(db, c.id);
  const r = spinDaily(db, c.id, "2026-07-01", 0); // rand 0 → 小糖果 +2
  expect(r.ok).toBe(true);
  expect(r.prize!.reward).toBe(2);
  expect(getBalance(db, c.id)).toBe(bal + 2);

  const again = spinDaily(db, c.id, "2026-07-01", 0);
  expect(again.ok).toBe(false);
  expect(getBalance(db, c.id)).toBe(bal + 2);
  expect(getSpinStatus(db, c.id, "2026-07-01").spun).toBe(true);
});

test("empty day is not unlocked", () => {
  const { db, c } = setup();
  expect(getSpinStatus(db, c.id, "2026-07-01").unlocked).toBe(false);
});
