export function computePoints(input: {
  basePoints: number;
  bonusPoints: number;
  onTimeBonus: number;
  errorCount: number;
  errorPenalty: number;
  minPoints: number;
}): number {
  const points =
    input.basePoints +
    input.bonusPoints +
    input.onTimeBonus -
    input.errorCount * input.errorPenalty;
  return Math.max(input.minPoints, points);
}
