import type { DB } from "@/lib/sqlite-compat";
import type { Reward } from "@/lib/types";
import { addPointEntry, getBalance } from "@/lib/repositories/points";

export function createReward(
  db: DB,
  input: { name: string; cost: number },
): Reward {
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("请填写奖励名");
  const info = db
    .prepare("INSERT INTO rewards (name, cost, active) VALUES (?, ?, 1)")
    .run(name, input.cost);
  return db
    .prepare("SELECT * FROM rewards WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as Reward;
}

export function listRewards(db: DB): Reward[] {
  return db
    .prepare("SELECT * FROM rewards WHERE active = 1 ORDER BY cost")
    .all() as Reward[];
}

export function redeemReward(
  db: DB,
  input: { childId: number; rewardId: number; quantity?: number; now?: string },
): { balance: number } {
  const qty = Math.trunc(input.quantity ?? 1);
  if (!Number.isFinite(qty) || qty < 1) throw new Error("兑换次数不合法");
  const reward = db
    .prepare("SELECT * FROM rewards WHERE id = ?")
    .get(input.rewardId) as Reward | undefined;
  if (!reward) throw new Error("奖励不存在");
  const totalCost = reward.cost * qty;
  const tx = db.transaction(() => {
    if (getBalance(db, input.childId) < totalCost) throw new Error("积分不足");
    addPointEntry(db, {
      childId: input.childId,
      delta: -totalCost,
      reason: qty > 1 ? `兑换: ${reward.name} ×${qty}` : `兑换: ${reward.name}`,
      rewardId: reward.id,
      now: input.now,
    });
  });
  tx();
  return { balance: getBalance(db, input.childId) };
}

export function updateReward(
  db: DB,
  id: number,
  input: { name: string; cost: number },
): Reward {
  db.prepare("UPDATE rewards SET name = ?, cost = ? WHERE id = ?")
    .run(input.name, input.cost, id);
  return db.prepare("SELECT * FROM rewards WHERE id = ?").get(id) as Reward;
}

export function archiveReward(db: DB, id: number): void {
  db.prepare("UPDATE rewards SET active = 0 WHERE id = ?").run(id);
}

export function restoreReward(db: DB, id: number): void {
  db.prepare("UPDATE rewards SET active = 1 WHERE id = ?").run(id);
}

export function listAllRewards(db: DB): Reward[] {
  return db
    .prepare("SELECT * FROM rewards ORDER BY active DESC, cost")
    .all() as Reward[];
}
