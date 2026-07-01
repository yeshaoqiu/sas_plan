export const PET_STAGES = [
  { min: 0, emoji: "🥚", name: "蛋" },
  { min: 30, emoji: "🐣", name: "破壳" },
  { min: 80, emoji: "🐤", name: "小鸡" },
  { min: 160, emoji: "🐔", name: "大公鸡" },
  { min: 280, emoji: "🦚", name: "孔雀" },
  { min: 450, emoji: "🦅", name: "雄鹰" },
] as const;

export function getPetStage(earned: number): {
  level: number;
  emoji: string;
  name: string;
  curMin: number;
  nextMin: number | null;
  toNext: number;
} {
  let idx = 0;
  for (let i = 0; i < PET_STAGES.length; i++) {
    if (earned >= PET_STAGES[i].min) idx = i;
  }
  const stage = PET_STAGES[idx];
  const next = idx + 1 < PET_STAGES.length ? PET_STAGES[idx + 1] : null;
  return {
    level: idx + 1,
    emoji: stage.emoji,
    name: stage.name,
    curMin: stage.min,
    nextMin: next ? next.min : null,
    toNext: next ? next.min - earned : 0,
  };
}
