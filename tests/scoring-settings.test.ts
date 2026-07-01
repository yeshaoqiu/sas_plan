import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { getScoringSettings, updateScoringSettings } from "@/lib/repositories/scoringSettings";

test("get returns seeded defaults", () => {
  const db = createDb(":memory:");
  expect(getScoringSettings(db)).toEqual({ onTimeBonus: 3, errorPenalty: 2, minPoints: 1 });
});

test("update changes settings", () => {
  const db = createDb(":memory:");
  const s = updateScoringSettings(db, { onTimeBonus: 5, errorPenalty: 1, minPoints: 2 });
  expect(s).toEqual({ onTimeBonus: 5, errorPenalty: 1, minPoints: 2 });
  expect(getScoringSettings(db)).toEqual({ onTimeBonus: 5, errorPenalty: 1, minPoints: 2 });
});
