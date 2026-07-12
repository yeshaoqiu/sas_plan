import { expect, test } from "vitest";
import { evaluateBadges, BADGE_DEFS } from "@/lib/badges";

const zero = { earned: 0, maxStreak: 0, scoredCount: 0, focusedCount: 0, checkedCount: 0 };

function get(badges: ReturnType<typeof evaluateBadges>, id: string) {
  const b = badges.find((x) => x.id === id);
  if (!b) throw new Error(`badge ${id} missing`);
  return b;
}

test("nothing unlocked at zero", () => {
  const badges = evaluateBadges(zero);
  expect(badges.every((b) => !b.unlocked)).toBe(true);
  expect(badges.length).toBe(BADGE_DEFS.length);
});

test("first-star unlocks at 1 scored task", () => {
  const badges = evaluateBadges({ ...zero, scoredCount: 1 });
  expect(get(badges, "first-star").unlocked).toBe(true);
});

test("star thresholds", () => {
  expect(get(evaluateBadges({ ...zero, earned: 100 }), "star-100").unlocked).toBe(true);
  expect(get(evaluateBadges({ ...zero, earned: 99 }), "star-100").unlocked).toBe(false);
  expect(get(evaluateBadges({ ...zero, earned: 1000 }), "star-1000").unlocked).toBe(true);
});

test("streak badges use max streak", () => {
  const badges = evaluateBadges({ ...zero, maxStreak: 7 });
  expect(get(badges, "streak-3").unlocked).toBe(true);
  expect(get(badges, "streak-7").unlocked).toBe(true);
  expect(get(badges, "streak-30").unlocked).toBe(false);
});

test("focus badge", () => {
  expect(get(evaluateBadges({ ...zero, focusedCount: 20 }), "focus-20").unlocked).toBe(true);
  expect(get(evaluateBadges({ ...zero, focusedCount: 19 }), "focus-20").unlocked).toBe(false);
});

test("check badge", () => {
  expect(get(evaluateBadges({ ...zero, checkedCount: 10 }), "check-10").unlocked).toBe(true);
  expect(get(evaluateBadges({ ...zero, checkedCount: 9 }), "check-10").unlocked).toBe(false);
  expect(get(evaluateBadges({ ...zero, checkedCount: 50 }), "check-50").unlocked).toBe(true);
});
