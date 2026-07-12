export interface Prize {
  id: string;
  emoji: string;
  label: string;
  reward: number;
  weight: number;
}

// 奖品表：小奖概率高，大奖稀有，制造期待感
export const SPIN_PRIZES: Prize[] = [
  { id: "p2", emoji: "🍬", label: "小糖果", reward: 2, weight: 30 },
  { id: "p5", emoji: "⭐", label: "5 颗星", reward: 5, weight: 30 },
  { id: "p8", emoji: "✨", label: "8 颗星", reward: 8, weight: 20 },
  { id: "p12", emoji: "🌟", label: "12 颗星", reward: 12, weight: 12 },
  { id: "p20", emoji: "🎁", label: "20 颗星", reward: 20, weight: 6 },
  { id: "p50", emoji: "💎", label: "大奖 50 颗星", reward: 50, weight: 2 },
];

export const SPIN_TOTAL_WEIGHT = SPIN_PRIZES.reduce((s, p) => s + p.weight, 0);

// rand ∈ [0,1)，按权重选中一个奖品。便于测试的纯函数。
export function pickPrize(rand: number): Prize {
  const r = Math.min(Math.max(rand, 0), 0.999999) * SPIN_TOTAL_WEIGHT;
  let acc = 0;
  for (const p of SPIN_PRIZES) {
    acc += p.weight;
    if (r < acc) return p;
  }
  return SPIN_PRIZES[SPIN_PRIZES.length - 1];
}

export function spinReasonFor(date: string): string {
  return `每日转盘:${date}`;
}
