export interface StreakMilestone {
  days: number;
  reward: number;
  label: string;
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 3, reward: 5, label: "连续 3 天" },
  { days: 7, reward: 15, label: "连续 7 天" },
  { days: 30, reward: 50, label: "连续 30 天" },
];

export function reasonFor(days: number): string {
  return `连续打卡奖励:${days}天`;
}

// 返回已达成且尚未发放的里程碑
export function pendingMilestones(
  streak: number,
  awardedDays: Set<number>,
): StreakMilestone[] {
  return STREAK_MILESTONES.filter(
    (m) => streak >= m.days && !awardedDays.has(m.days),
  );
}
