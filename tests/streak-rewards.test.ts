import { expect, test } from "vitest";
import { pendingMilestones, STREAK_MILESTONES, reasonFor } from "@/lib/streakRewards";

test("no milestone below 3 days", () => {
  expect(pendingMilestones(2, new Set())).toEqual([]);
});

test("3-day milestone becomes pending at streak 3", () => {
  const p = pendingMilestones(3, new Set());
  expect(p.map((m) => m.days)).toEqual([3]);
});

test("streak 7 yields both 3 and 7 if none awarded", () => {
  const p = pendingMilestones(7, new Set());
  expect(p.map((m) => m.days)).toEqual([3, 7]);
});

test("already-awarded milestones are excluded (idempotent)", () => {
  const p = pendingMilestones(7, new Set([3]));
  expect(p.map((m) => m.days)).toEqual([7]);
});

test("all awarded → nothing pending", () => {
  const all = new Set(STREAK_MILESTONES.map((m) => m.days));
  expect(pendingMilestones(30, all)).toEqual([]);
});

test("reasonFor is stable per day", () => {
  expect(reasonFor(7)).toBe("连续打卡奖励:7天");
});
