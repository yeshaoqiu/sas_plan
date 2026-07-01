import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { addPointEntry, getLifetimeEarned } from "@/lib/repositories/points";

test("sums only positive deltas; redemptions do not reduce it", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  expect(getLifetimeEarned(db, c.id)).toBe(0);
  addPointEntry(db, { childId: c.id, delta: 15, reason: "完成任务" });
  addPointEntry(db, { childId: c.id, delta: 20, reason: "完成任务" });
  addPointEntry(db, { childId: c.id, delta: -30, reason: "兑换" }); // ignored
  expect(getLifetimeEarned(db, c.id)).toBe(35);
});
