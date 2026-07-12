import type { DB } from "@/lib/sqlite-compat";
import { addPointEntry } from "@/lib/repositories/points";
import {
  STREAK_MILESTONES,
  pendingMilestones,
  reasonFor,
} from "@/lib/streakRewards";
import { pickPrize, spinReasonFor, type Prize } from "@/lib/spin";

function prevDay(date: string): string {
  const dt = new Date(date + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function getStreak(
  db: DB,
  childId: number,
  today: string,
): number {
  const rows = db
    .prepare(
      "SELECT DISTINCT date FROM task_instances WHERE child_id = ? AND status = 'scored'",
    )
    .all(childId) as { date: string }[];
  const days = new Set(rows.map((r) => r.date));

  const yesterday = prevDay(today);
  let anchor: string | null = null;
  if (days.has(today)) anchor = today;
  else if (days.has(yesterday)) anchor = yesterday;
  if (anchor === null) return 0;

  let count = 0;
  let d: string = anchor;
  while (days.has(d)) {
    count++;
    d = prevDay(d);
  }
  return count;
}

export function getMaxStreak(db: DB, childId: number): number {
  const rows = db
    .prepare(
      "SELECT DISTINCT date FROM task_instances WHERE child_id = ? AND status = 'scored' ORDER BY date",
    )
    .all(childId) as { date: string }[];
  const days = rows.map((r) => r.date);
  if (days.length === 0) return 0;

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (prevDay(days[i]) === days[i - 1]) {
      run++;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}

// 统计带有「名字含指定关键字」的加分项的已评分任务数。
// 专注/检查记录在 task_bonus 关联表里（不是 task_instances 的死列 focused/did_check），
// 加分项没有稳定 id，故按名字关键字匹配，对增删改顺序都健壮。
function countTasksWithBonusKeyword(db: DB, childId: number, keyword: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT ti.id) AS c
         FROM task_instances ti
         JOIN task_bonus tb ON tb.task_instance_id = ti.id
         JOIN bonus_items bi ON bi.id = tb.bonus_item_id
        WHERE ti.child_id = ? AND ti.status = 'scored' AND bi.name LIKE ?`,
    )
    .get(childId, `%${keyword}%`) as { c: number };
  return row.c;
}

export function getBadgeStats(
  db: DB,
  childId: number,
): { scoredCount: number; focusedCount: number; checkedCount: number } {
  const scored = db
    .prepare(
      "SELECT COUNT(*) AS c FROM task_instances WHERE child_id = ? AND status = 'scored'",
    )
    .get(childId) as { c: number };
  return {
    scoredCount: scored.c,
    focusedCount: countTasksWithBonusKeyword(db, childId, "专注"),
    checkedCount: countTasksWithBonusKeyword(db, childId, "检查"),
  };
}

// 检查当前连续天数并发放尚未领取的里程碑奖励（幂等，靠 reason 去重）。
// 返回本次新发放的里程碑（供前端庆祝展示）。
export function grantStreakRewards(
  db: DB,
  childId: number,
  today: string,
  now?: string,
): { days: number; reward: number; label: string }[] {
  const streak = getStreak(db, childId, today);
  if (streak <= 0) return [];

  const reasons = STREAK_MILESTONES.map((m) => reasonFor(m.days));
  const placeholders = reasons.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT reason FROM point_entries WHERE child_id = ? AND reason IN (${placeholders})`,
    )
    .all(childId, ...reasons) as { reason: string }[];
  const awardedDays = new Set(
    STREAK_MILESTONES.filter((m) =>
      rows.some((r) => r.reason === reasonFor(m.days)),
    ).map((m) => m.days),
  );

  const pending = pendingMilestones(streak, awardedDays);
  for (const m of pending) {
    addPointEntry(db, {
      childId,
      delta: m.reward,
      reason: reasonFor(m.days),
      now,
    });
  }
  return pending;
}

// 当天转盘状态：是否已解锁（全部任务完成）、是否已抽过、今天抽到的奖品
export function getSpinStatus(
  db: DB,
  childId: number,
  date: string,
): { unlocked: boolean; spun: boolean; prizeReward: number | null } {
  const total = (
    db
      .prepare("SELECT COUNT(*) AS n FROM task_instances WHERE child_id = ? AND date = ?")
      .get(childId, date) as { n: number }
  ).n;
  const scored = (
    db
      .prepare("SELECT COUNT(*) AS n FROM task_instances WHERE child_id = ? AND date = ? AND status = 'scored'")
      .get(childId, date) as { n: number }
  ).n;
  const unlocked = total > 0 && scored === total;

  const row = db
    .prepare("SELECT delta FROM point_entries WHERE child_id = ? AND reason = ?")
    .get(childId, spinReasonFor(date)) as { delta: number } | undefined;

  return { unlocked, spun: !!row, prizeReward: row ? row.delta : null };
}

// 抽一次每日转盘。rand ∈ [0,1) 由调用方注入（route 用 Math.random）。
// 需当天任务全部完成，且每天仅一次（靠 reason 去重）。
export function spinDaily(
  db: DB,
  childId: number,
  date: string,
  rand: number,
  now?: string,
): { ok: boolean; error?: string; prize?: Prize } {
  const status = getSpinStatus(db, childId, date);
  if (!status.unlocked) return { ok: false, error: "先完成当天全部任务才能抽奖哦" };
  if (status.spun) return { ok: false, error: "今天已经抽过啦，明天再来" };

  const prize = pickPrize(rand);
  addPointEntry(db, {
    childId,
    delta: prize.reward,
    reason: spinReasonFor(date),
    now,
  });
  return { ok: true, prize };
}
