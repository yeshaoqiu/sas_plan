import { expect, test } from "vitest";
import { computePoints } from "@/lib/scoring";

test("base only", () => {
  expect(computePoints({ basePoints: 10, focused: false, usedScaffold: false, didCheck: false, errorCount: 0 })).toBe(10);
});

test("all bonuses add up", () => {
  expect(computePoints({ basePoints: 10, focused: true, usedScaffold: true, didCheck: true, errorCount: 0 })).toBe(25);
});

test("errors apply penalty", () => {
  expect(computePoints({ basePoints: 10, focused: false, usedScaffold: false, didCheck: false, errorCount: 3 })).toBe(4);
});

test("never below MIN_POINTS", () => {
  expect(computePoints({ basePoints: 2, focused: false, usedScaffold: false, didCheck: false, errorCount: 10 })).toBe(1);
});
