import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { addPointEntry, getBalance } from "@/lib/repositories/points";
import { createReward, listRewards, redeemReward } from "@/lib/repositories/rewards";

test("create and list rewards", () => {
  const db = createDb(":memory:");
  createReward(db, { name: "看动画30分钟", cost: 30 });
  expect(listRewards(db)).toHaveLength(1);
});

test("redeem deducts points", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const r = createReward(db, { name: "看动画30分钟", cost: 30 });
  addPointEntry(db, { childId: c.id, delta: 50, reason: "完成任务" });
  const res = redeemReward(db, { childId: c.id, rewardId: r.id });
  expect(res.balance).toBe(20);
  expect(getBalance(db, c.id)).toBe(20);
});

test("redeem fails when insufficient", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const r = createReward(db, { name: "出游", cost: 100 });
  addPointEntry(db, { childId: c.id, delta: 10, reason: "完成任务" });
  expect(() => redeemReward(db, { childId: c.id, rewardId: r.id })).toThrow("积分不足");
});
