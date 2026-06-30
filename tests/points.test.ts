import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { addPointEntry, getBalance, listEntries } from "@/lib/repositories/points";

test("balance is sum of deltas", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  expect(getBalance(db, c.id)).toBe(0);
  addPointEntry(db, { childId: c.id, delta: 20, reason: "完成任务" });
  addPointEntry(db, { childId: c.id, delta: -5, reason: "兑换" });
  expect(getBalance(db, c.id)).toBe(15);
  expect(listEntries(db, c.id)).toHaveLength(2);
});
