import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild, setWish, getWishProgress } from "@/lib/repositories/children";
import { createReward, archiveReward } from "@/lib/repositories/rewards";
import { addPointEntry } from "@/lib/repositories/points";

function setup() {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const r = createReward(db, { name: "乐高", cost: 200 });
  return { db, c, r };
}

test("no wish by default", () => {
  const { db, c } = setup();
  const w = getWishProgress(db, c.id);
  expect(w.reward).toBeNull();
  expect(w.achieved).toBe(false);
});

test("set wish tracks remaining and achievement", () => {
  const { db, c, r } = setup();
  setWish(db, c.id, r.id);
  addPointEntry(db, { childId: c.id, delta: 120, reason: "test" });

  let w = getWishProgress(db, c.id);
  expect(w.reward?.id).toBe(r.id);
  expect(w.balance).toBe(120);
  expect(w.remaining).toBe(80);
  expect(w.achieved).toBe(false);

  addPointEntry(db, { childId: c.id, delta: 100, reason: "test" });
  w = getWishProgress(db, c.id);
  expect(w.remaining).toBe(0);
  expect(w.achieved).toBe(true);
});

test("clearing wish resets", () => {
  const { db, c, r } = setup();
  setWish(db, c.id, r.id);
  setWish(db, c.id, null);
  expect(getWishProgress(db, c.id).reward).toBeNull();
});

test("setting nonexistent reward throws", () => {
  const { db, c } = setup();
  expect(() => setWish(db, c.id, 9999)).toThrow();
});

test("archived wish reward is treated as no wish", () => {
  const { db, c, r } = setup();
  setWish(db, c.id, r.id);
  archiveReward(db, r.id);
  expect(getWishProgress(db, c.id).reward).toBeNull();
});
