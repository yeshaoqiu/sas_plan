import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import {
  createChild, listChildren, listAllChildren, getChild,
  updateChild, archiveChild, restoreChild,
} from "@/lib/repositories/children";

test("update changes fields", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const u = updateChild(db, c.id, { name: "小明明", grade: 2, avatar: "🐼" });
  expect(u.name).toBe("小明明");
  expect(u.grade).toBe(2);
  expect(u.avatar).toBe("🐼");
});

test("archive hides from listChildren but keeps in listAllChildren; restore brings back", () => {
  const db = createDb(":memory:");
  const a = createChild(db, { name: "老大", grade: 2 });
  const b = createChild(db, { name: "老二", grade: 1 });
  archiveChild(db, b.id);
  expect(listChildren(db).map((c) => c.id)).toEqual([a.id]);
  expect(listAllChildren(db)).toHaveLength(2);
  expect(getChild(db, b.id)?.archived).toBe(1);
  restoreChild(db, b.id);
  expect(listChildren(db).map((c) => c.id)).toEqual([a.id, b.id]);
});
