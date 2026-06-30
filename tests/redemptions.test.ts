import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createReward, redeemReward } from "@/lib/repositories/rewards";
import { addPointEntry, listRedemptions } from "@/lib/repositories/points";

test("listRedemptions returns only reward redemptions, newest first", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  addPointEntry(db, { childId: c.id, delta: 200, reason: "完成任务: 写字" }); // not a redemption
  const r1 = createReward(db, { name: "看动画", cost: 30 });
  const r2 = createReward(db, { name: "出游", cost: 80 });
  redeemReward(db, { childId: c.id, rewardId: r1.id });
  redeemReward(db, { childId: c.id, rewardId: r2.id });

  const list = listRedemptions(db, c.id);
  expect(list).toHaveLength(2);
  // newest first (出游 redeemed last)
  expect(list[0].reason).toBe("兑换: 出游");
  expect(list[0].delta).toBe(-80);
  expect(list[0].rewardId).toBe(r2.id);
  expect(list[1].reason).toBe("兑换: 看动画");
  // the non-redemption entry is excluded
  expect(list.every((e) => e.rewardId !== null)).toBe(true);
});
