import type Database from "better-sqlite3";
import type { Reward } from "@/lib/types";
import { addPointEntry, getBalance } from "@/lib/repositories/points";

export function createReward(
  db: Database.Database,
  input: { name: string; cost: number },
): Reward {
  const info = db
    .prepare("INSERT INTO rewards (name, cost, active) VALUES (?, ?, 1)")
    .run(input.name, input.cost);
  return db
    .prepare("SELECT * FROM rewards WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as Reward;
}

export function listRewards(db: Database.Database): Reward[] {
  return db
    .prepare("SELECT * FROM rewards WHERE active = 1 ORDER BY cost")
    .all() as Reward[];
}

export function redeemReward(
  db: Database.Database,
  input: { childId: number; rewardId: number; now?: string },
): { balance: number } {
  const reward = db
    .prepare("SELECT * FROM rewards WHERE id = ?")
    .get(input.rewardId) as Reward | undefined;
  if (!reward) throw new Error("奖励不存在");
  if (getBalance(db, input.childId) < reward.cost) throw new Error("积分不足");
  addPointEntry(db, {
    childId: input.childId,
    delta: -reward.cost,
    reason: `兑换: ${reward.name}`,
    rewardId: reward.id,
    now: input.now,
  });
  return { balance: getBalance(db, input.childId) };
}
