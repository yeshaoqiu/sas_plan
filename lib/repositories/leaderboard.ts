import type { DB } from "@/lib/sqlite-compat";
import { listChildren } from "@/lib/repositories/children";
import { getStreak, getMaxStreak } from "@/lib/repositories/growth";
import { getLifetimeEarned } from "@/lib/repositories/points";

export interface LeaderRow {
  childId: number;
  name: string;
  avatar: string;
  weekEarned: number;
  streak: number;
  maxStreak: number;
  lifetimeEarned: number;
}

function weekEarned(db: DB, childId: number, weekStart: string): number {
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(delta), 0) AS s FROM point_entries WHERE child_id = ? AND delta > 0 AND created_at >= ?",
    )
    .get(childId, weekStart) as { s: number };
  return row.s;
}

// 按本周挣星降序排序的所有在册孩子。weekStart/today 由调用方注入。
export function getLeaderboard(
  db: DB,
  weekStart: string,
  today: string,
): LeaderRow[] {
  const rows = listChildren(db).map((c) => ({
    childId: c.id,
    name: c.name,
    avatar: c.avatar,
    weekEarned: weekEarned(db, c.id, weekStart),
    streak: getStreak(db, c.id, today),
    maxStreak: getMaxStreak(db, c.id),
    lifetimeEarned: getLifetimeEarned(db, c.id),
  }));
  rows.sort((a, b) => b.weekEarned - a.weekEarned || b.streak - a.streak);
  return rows;
}
