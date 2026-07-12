import { expect, test } from "vitest";
import { pickPrize, SPIN_PRIZES, SPIN_TOTAL_WEIGHT } from "@/lib/spin";

test("rand 0 picks first prize", () => {
  expect(pickPrize(0).id).toBe(SPIN_PRIZES[0].id);
});

test("rand near 1 picks last (rarest) prize", () => {
  expect(pickPrize(0.999).id).toBe(SPIN_PRIZES[SPIN_PRIZES.length - 1].id);
});

test("weights sum matches constant", () => {
  expect(SPIN_TOTAL_WEIGHT).toBe(SPIN_PRIZES.reduce((s, p) => s + p.weight, 0));
});

test("boundary lands in correct bucket", () => {
  // 第一档权重 30 / 总 100 → rand 恰好 0.30 应进入第二档
  const first = SPIN_PRIZES[0];
  const justBelow = pickPrize((first.weight - 1) / SPIN_TOTAL_WEIGHT);
  const atBoundary = pickPrize(first.weight / SPIN_TOTAL_WEIGHT);
  expect(justBelow.id).toBe(first.id);
  expect(atBoundary.id).toBe(SPIN_PRIZES[1].id);
});

test("all rand values return a valid prize", () => {
  for (let i = 0; i < 100; i++) {
    const p = pickPrize(i / 100);
    expect(SPIN_PRIZES.some((x) => x.id === p.id)).toBe(true);
  }
});

test("out-of-range rand is clamped", () => {
  expect(pickPrize(-0.5).id).toBe(SPIN_PRIZES[0].id);
  expect(pickPrize(1.5).id).toBe(SPIN_PRIZES[SPIN_PRIZES.length - 1].id);
});
