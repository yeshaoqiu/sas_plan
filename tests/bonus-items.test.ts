import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import {
  listBonusItems, listAllBonusItems, createBonusItem,
  updateBonusItem, archiveBonusItem, restoreBonusItem,
} from "@/lib/repositories/bonusItems";

test("list returns seeded active items ordered", () => {
  const db = createDb(":memory:");
  const names = listBonusItems(db).map((b) => b.name);
  expect(names).toEqual(["专注完成", "用上支架", "做了检查"]);
});

test("create, update, archive/restore", () => {
  const db = createDb(":memory:");
  const b = createBonusItem(db, { name: "字迹工整", description: "字写得整齐", points: 4, sortOrder: 9 });
  expect(b.id).toBeGreaterThan(0);
  expect(b.points).toBe(4);

  const u = updateBonusItem(db, b.id, { name: "字迹工整", description: "写得整齐好看", points: 6, sortOrder: 9 });
  expect(u.points).toBe(6);
  expect(u.description).toBe("写得整齐好看");

  archiveBonusItem(db, b.id);
  expect(listBonusItems(db).some((x) => x.id === b.id)).toBe(false);
  expect(listAllBonusItems(db).some((x) => x.id === b.id)).toBe(true);
  restoreBonusItem(db, b.id);
  expect(listBonusItems(db).some((x) => x.id === b.id)).toBe(true);
});
