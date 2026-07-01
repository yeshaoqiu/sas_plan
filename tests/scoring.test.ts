import { expect, test } from "vitest";
import { computePoints } from "@/lib/scoring";

test("base only", () => {
  expect(computePoints({ basePoints: 10, bonusPoints: 0, onTimeBonus: 0, errorCount: 0, errorPenalty: 2, minPoints: 1 })).toBe(10);
});

test("adds bonus points and on-time bonus", () => {
  expect(computePoints({ basePoints: 10, bonusPoints: 10, onTimeBonus: 3, errorCount: 0, errorPenalty: 2, minPoints: 1 })).toBe(23);
});

test("subtracts error penalty", () => {
  expect(computePoints({ basePoints: 10, bonusPoints: 0, onTimeBonus: 0, errorCount: 3, errorPenalty: 2, minPoints: 1 })).toBe(4);
});

test("floors at minPoints", () => {
  expect(computePoints({ basePoints: 2, bonusPoints: 0, onTimeBonus: 0, errorCount: 10, errorPenalty: 2, minPoints: 1 })).toBe(1);
});
