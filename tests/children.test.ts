import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild, listChildren, getChild } from "@/lib/repositories/children";

test("create and list children", () => {
  const db = createDb(":memory:");
  const a = createChild(db, { name: "小明", grade: 1 });
  const b = createChild(db, { name: "小红", grade: 2, avatar: "🐰" });
  expect(a.id).toBeGreaterThan(0);
  expect(a.avatar).toBe("🐣"); // 默认头像
  expect(b.avatar).toBe("🐰");
  expect(listChildren(db)).toHaveLength(2);
  expect(getChild(db, a.id)?.name).toBe("小明");
});
