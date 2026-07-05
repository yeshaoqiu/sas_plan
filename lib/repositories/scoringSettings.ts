import type { DB } from "@/lib/sqlite-compat";
import type { ScoringSettings } from "@/lib/types";

export function getScoringSettings(db: DB): ScoringSettings {
  const r = db
    .prepare("SELECT on_time_bonus, error_penalty, min_points FROM scoring_settings WHERE id = 1")
    .get() as { on_time_bonus: number; error_penalty: number; min_points: number };
  return {
    onTimeBonus: r.on_time_bonus,
    errorPenalty: r.error_penalty,
    minPoints: r.min_points,
  };
}

export function updateScoringSettings(
  db: DB,
  input: { onTimeBonus: number; errorPenalty: number; minPoints: number },
): ScoringSettings {
  db.prepare(
    "UPDATE scoring_settings SET on_time_bonus = ?, error_penalty = ?, min_points = ? WHERE id = 1",
  ).run(input.onTimeBonus, input.errorPenalty, input.minPoints);
  return getScoringSettings(db);
}
