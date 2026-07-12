export const PET_STAGES = [
  { min: 0, emoji: "🥚", name: "蛋" },
  { min: 30, emoji: "🐣", name: "破壳" },
  { min: 80, emoji: "🐤", name: "小鸡" },
  { min: 160, emoji: "🐔", name: "大公鸡" },
  { min: 280, emoji: "🦚", name: "孔雀" },
  { min: 450, emoji: "🦅", name: "雄鹰" },
  { min: 680, emoji: "🦉", name: "灵枭" },
  { min: 1000, emoji: "🦢", name: "天鹅王" },
  { min: 1400, emoji: "🐲", name: "幼龙" },
  { min: 1900, emoji: "🐉", name: "神龙" },
  { min: 2600, emoji: "🦄", name: "麒麟" },
  { min: 3500, emoji: "🔥", name: "凤凰" },
  { min: 4600, emoji: "🌋", name: "火山龙" },
  { min: 5900, emoji: "🐙", name: "深海巨兽" },
  { min: 7000, emoji: "🦖", name: "霸王龙" },
  { min: 8000, emoji: "🌈", name: "彩虹神兽" },
  { min: 9000, emoji: "⭐", name: "星辰使者" },
  { min: 9500, emoji: "🌟", name: "宇宙之王" },
] as const;

export function getPetStage(earned: number): {
  level: number;
  emoji: string;
  name: string;
  curMin: number;
  nextMin: number | null;
  nextEmoji: string | null;
  nextName: string | null;
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
    nextEmoji: next ? next.emoji : null,
    nextName: next ? next.name : null,
    toNext: next ? next.min - earned : 0,
  };
}
