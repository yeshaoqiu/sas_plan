export interface BadgeStats {
  earned: number;
  maxStreak: number;
  scoredCount: number;
  focusedCount: number;
  checkedCount: number;
}

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  unlocked: boolean;
}

interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  test: (s: BadgeStats) => boolean;
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: "first-star", emoji: "⭐", name: "初露锋芒", desc: "完成第一次评分", test: (s) => s.scoredCount >= 1 },
  { id: "star-100", emoji: "💯", name: "百星达人", desc: "累计获得 100 颗星", test: (s) => s.earned >= 100 },
  { id: "star-500", emoji: "🌟", name: "星光熠熠", desc: "累计获得 500 颗星", test: (s) => s.earned >= 500 },
  { id: "star-1000", emoji: "🏆", name: "星海无涯", desc: "累计获得 1000 颗星", test: (s) => s.earned >= 1000 },
  { id: "star-3000", emoji: "💎", name: "钻石收藏家", desc: "累计获得 3000 颗星", test: (s) => s.earned >= 3000 },
  { id: "star-5000", emoji: "👑", name: "星辰之主", desc: "累计获得 5000 颗星", test: (s) => s.earned >= 5000 },
  { id: "streak-3", emoji: "🔥", name: "三日不辍", desc: "连续 3 天完成任务", test: (s) => s.maxStreak >= 3 },
  { id: "streak-7", emoji: "📅", name: "一周坚持", desc: "连续 7 天完成任务", test: (s) => s.maxStreak >= 7 },
  { id: "streak-14", emoji: "🗓️", name: "两周达人", desc: "连续 14 天完成任务", test: (s) => s.maxStreak >= 14 },
  { id: "streak-30", emoji: "🏅", name: "月度冠军", desc: "连续 30 天完成任务", test: (s) => s.maxStreak >= 30 },
  { id: "streak-100", emoji: "🎖️", name: "百日筑基", desc: "连续 100 天完成任务", test: (s) => s.maxStreak >= 100 },
  { id: "task-50", emoji: "📚", name: "勤学不倦", desc: "累计完成 50 个任务", test: (s) => s.scoredCount >= 50 },
  { id: "task-200", emoji: "🎓", name: "学识渊博", desc: "累计完成 200 个任务", test: (s) => s.scoredCount >= 200 },
  { id: "task-500", emoji: "🧠", name: "学霸传说", desc: "累计完成 500 个任务", test: (s) => s.scoredCount >= 500 },
  { id: "focus-20", emoji: "🎯", name: "专注小能手", desc: "专注完成 20 个任务", test: (s) => s.focusedCount >= 20 },
  { id: "focus-100", emoji: "🧘", name: "专注大师", desc: "专注完成 100 个任务", test: (s) => s.focusedCount >= 100 },
  { id: "check-10", emoji: "🔍", name: "检查小卫士", desc: "主动检查 10 次", test: (s) => s.checkedCount >= 10 },
  { id: "check-50", emoji: "🦉", name: "火眼金睛", desc: "主动检查 50 次", test: (s) => s.checkedCount >= 50 },
];

export function evaluateBadges(stats: BadgeStats): Badge[] {
  return BADGE_DEFS.map((d) => ({
    id: d.id,
    emoji: d.emoji,
    name: d.name,
    desc: d.desc,
    unlocked: d.test(stats),
  }));
}
