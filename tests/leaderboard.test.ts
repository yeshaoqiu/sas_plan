import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask, scoreTask } from "@/lib/repositories/tasks";
import { getLeaderboard } from "@/lib/repositories/leaderboard";

function setup() {
  const db = createDb(":memory:");
  const tpl = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  return { db, tpl };
}

function scoreOn(db: ReturnType<typeof createDb>, childId: number, tplId: number, date: string) {
  const t = assignTask(db, { childId, templateId: tplId, date });
  scoreTask(db, t.id, { actualMinutes: 5, bonusItemIds: [], errorCount: 0, now: date + "T09:00:00.000Z" });
}

test("orders children by week earned desc", () => {
  const { db, tpl } = setup();
  const a = createChild(db, { name: "老大", grade: 3 });
  const b = createChild(db, { name: "老二", grade: 1 });

  // 本周一 = 2026-07-06；老二本周多做一次
  scoreOn(db, a.id, tpl.id, "2026-07-06");
  scoreOn(db, b.id, tpl.id, "2026-07-06");
  scoreOn(db, b.id, tpl.id, "2026-07-07");

  const board = getLeaderboard(db, "2026-07-06", "2026-07-07");
  expect(board[0].childId).toBe(b.id);
  expect(board[0].weekEarned).toBe(26); // 2 * 13
  expect(board[1].childId).toBe(a.id);
  expect(board[1].weekEarned).toBe(13);
});

test("excludes earnings before week start", () => {
  const { db, tpl } = setup();
  const a = createChild(db, { name: "小明", grade: 2 });
  scoreOn(db, a.id, tpl.id, "2026-07-05"); // 上周日
  scoreOn(db, a.id, tpl.id, "2026-07-06"); // 本周一

  const board = getLeaderboard(db, "2026-07-06", "2026-07-06");
  expect(board[0].weekEarned).toBe(13); // 仅本周一那次
  expect(board[0].lifetimeEarned).toBe(26); // 累计含两次
});
