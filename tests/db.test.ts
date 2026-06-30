import { expect, test } from "vitest";
import { createDb } from "@/lib/db";

test("createDb creates all tables", () => {
  const db = createDb(":memory:");
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as { name: string }[];
  const names = rows.map((r) => r.name);
  for (const t of ["children", "task_templates", "task_instances", "point_entries", "rewards"]) {
    expect(names).toContain(t);
  }
});
