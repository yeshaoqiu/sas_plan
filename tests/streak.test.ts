import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask, scoreTask } from "@/lib/repositories/tasks";
import { getStreak } from "@/lib/repositories/growth";

function scoredOn(
  db: ReturnType<typeof createDb>,
  childId: number,
  tplId: number,
  date: string,
) {
  const t = assignTask(db, { childId, templateId: tplId, date });
  scoreTask(db, t.id, { actualMinutes: 5, bonusItemIds: [], errorCount: 0 });
}

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

test("counts consecutive scored days ending today", () => {
  const { db, c, tpl } = setup();
  scoredOn(db, c.id, tpl.id, "2026-06-29");
  scoredOn(db, c.id, tpl.id, "2026-06-30");
  scoredOn(db, c.id, tpl.id, "2026-07-01");
  expect(getStreak(db, c.id, "2026-07-01")).toBe(3);
});

test("today not done yet -> grace to yesterday", () => {
  const { db, c, tpl } = setup();
  scoredOn(db, c.id, tpl.id, "2026-06-30");
  scoredOn(db, c.id, tpl.id, "2026-07-01");
  // today = 07-02, nothing scored today, yesterday (07-01) yes
  expect(getStreak(db, c.id, "2026-07-02")).toBe(2);
});

test("gap breaks the streak", () => {
  const { db, c, tpl } = setup();
  scoredOn(db, c.id, tpl.id, "2026-06-28");
  scoredOn(db, c.id, tpl.id, "2026-06-30");
  scoredOn(db, c.id, tpl.id, "2026-07-01");
  expect(getStreak(db, c.id, "2026-07-01")).toBe(2); // 06-30,07-01; 06-29 missing
});

test("no recent activity -> 0", () => {
  const { db, c, tpl } = setup();
  scoredOn(db, c.id, tpl.id, "2026-06-20");
  expect(getStreak(db, c.id, "2026-07-01")).toBe(0); // neither today nor yesterday
});
