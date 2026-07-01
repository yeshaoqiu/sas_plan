import { expect, test } from "vitest";
import { createDb } from "@/lib/db";

test("daily_plan table exists", () => {
  const db = createDb(":memory:");
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='daily_plan'")
    .get() as { name: string } | undefined;
  expect(row?.name).toBe("daily_plan");
});
