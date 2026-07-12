import type { DB } from "@/lib/sqlite-compat";
import type { Child, Reward } from "@/lib/types";
import { getBalance } from "@/lib/repositories/points";

export function createChild(
  db: DB,
  input: { name: string; grade: number; avatar?: string },
): Child {
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("请填写孩子姓名");
  const info = db
    .prepare("INSERT INTO children (name, grade, avatar) VALUES (?, ?, ?)")
    .run(name, input.grade, input.avatar ?? "🐣");
  return getChild(db, Number(info.lastInsertRowid))!;
}

export function updateChild(
  db: DB,
  id: number,
  input: { name: string; grade: number; avatar: string },
): Child {
  db.prepare("UPDATE children SET name = ?, grade = ?, avatar = ? WHERE id = ?")
    .run(input.name, input.grade, input.avatar, id);
  return getChild(db, id)!;
}

export function archiveChild(db: DB, id: number): void {
  db.prepare("UPDATE children SET archived = 1 WHERE id = ?").run(id);
}

export function restoreChild(db: DB, id: number): void {
  db.prepare("UPDATE children SET archived = 0 WHERE id = ?").run(id);
}

export function listChildren(db: DB): Child[] {
  return db
    .prepare("SELECT * FROM children WHERE archived = 0 ORDER BY id")
    .all() as Child[];
}

export function listAllChildren(db: DB): Child[] {
  return db
    .prepare("SELECT * FROM children ORDER BY archived, id")
    .all() as Child[];
}

export function getChild(db: DB, id: number): Child | undefined {
  return db.prepare("SELECT * FROM children WHERE id = ?").get(id) as
    | Child
    | undefined;
}

export interface WishProgress {
  reward: { id: number; name: string; cost: number } | null;
  balance: number;
  remaining: number;
  achieved: boolean;
}

// 设置某孩子的心愿目标（一个当前上架的奖励）。传 null 清除。
export function setWish(db: DB, childId: number, rewardId: number | null): void {
  if (rewardId !== null) {
    const reward = db
      .prepare("SELECT id FROM rewards WHERE id = ? AND active = 1")
      .get(rewardId) as { id: number } | undefined;
    if (!reward) throw new Error("心愿奖励不存在或已下架");
  }
  db.prepare("UPDATE children SET wish_reward_id = ? WHERE id = ?").run(rewardId, childId);
}

export function getWishProgress(db: DB, childId: number): WishProgress {
  const balance = getBalance(db, childId);
  const child = getChild(db, childId);
  const wishId = child?.wish_reward_id ?? null;
  if (!wishId) return { reward: null, balance, remaining: 0, achieved: false };

  const reward = db
    .prepare("SELECT id, name, cost FROM rewards WHERE id = ? AND active = 1")
    .get(wishId) as Pick<Reward, "id" | "name" | "cost"> | undefined;
  // 心愿奖励被下架 → 视为无心愿
  if (!reward) return { reward: null, balance, remaining: 0, achieved: false };

  const remaining = Math.max(0, reward.cost - balance);
  return { reward, balance, remaining, achieved: balance >= reward.cost };
}
