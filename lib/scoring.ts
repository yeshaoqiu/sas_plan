export const FOCUS_BONUS = 5;
export const SCAFFOLD_BONUS = 5;
export const CHECK_BONUS = 5;
export const ERROR_PENALTY = 2;
export const MIN_POINTS = 1;

export function computePoints(input: {
  basePoints: number;
  focused: boolean;
  usedScaffold: boolean;
  didCheck: boolean;
  errorCount: number;
}): number {
  let points = input.basePoints;
  if (input.focused) points += FOCUS_BONUS;
  if (input.usedScaffold) points += SCAFFOLD_BONUS;
  if (input.didCheck) points += CHECK_BONUS;
  points -= input.errorCount * ERROR_PENALTY;
  return Math.max(MIN_POINTS, points);
}
