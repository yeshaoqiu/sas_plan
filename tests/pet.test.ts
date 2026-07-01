import { expect, test } from "vitest";
import { getPetStage } from "@/lib/pet";

test("level 1 egg at 0", () => {
  const s = getPetStage(0);
  expect(s.level).toBe(1);
  expect(s.emoji).toBe("🥚");
  expect(s.curMin).toBe(0);
  expect(s.nextMin).toBe(30);
  expect(s.toNext).toBe(30);
});

test("picks highest satisfied stage and computes toNext", () => {
  const s = getPetStage(100); // >=80 (🐤) but <160
  expect(s.level).toBe(3);
  expect(s.emoji).toBe("🐤");
  expect(s.curMin).toBe(80);
  expect(s.nextMin).toBe(160);
  expect(s.toNext).toBe(60);
});

test("max level has null nextMin and 0 toNext", () => {
  const s = getPetStage(1000); // >=450
  expect(s.level).toBe(6);
  expect(s.emoji).toBe("🦅");
  expect(s.nextMin).toBeNull();
  expect(s.toNext).toBe(0);
});

test("exact threshold promotes", () => {
  expect(getPetStage(30).emoji).toBe("🐣");
  expect(getPetStage(29).emoji).toBe("🥚");
});
