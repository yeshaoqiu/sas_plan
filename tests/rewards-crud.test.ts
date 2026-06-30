import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import {
  createReward, listRewards, listAllRewards,
  updateReward, archiveReward, restoreReward,
} from "@/lib/repositories/rewards";

test("update changes name and cost", () => {
  const db = createDb(":memory:");
  const r = createReward(db, { name: "看动画", cost: 30 });
  const u = updateReward(db, r.id, { name: "看动画40分钟", cost: 40 });
  expect(u.name).toBe("看动画40分钟");
  expect(u.cost).toBe(40);
});

test("archive removes from listRewards, kept in listAllRewards; restore brings back", () => {
  const db = createDb(":memory:");
  const r = createReward(db, { name: "出游", cost: 80 });
  archiveReward(db, r.id);
  expect(listRewards(db)).toHaveLength(0);
  expect(listAllRewards(db)).toHaveLength(1);
  expect(listAllRewards(db)[0].active).toBe(0);
  restoreReward(db, r.id);
  expect(listRewards(db)).toHaveLength(1);
});
