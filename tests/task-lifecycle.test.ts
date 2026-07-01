import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask, startTask, completeTask } from "@/lib/repositories/tasks";

function setup() {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const tpl = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  const t = assignTask(db, { childId: c.id, templateId: tpl.id, date: "2026-07-01" });
  return { db, t };
}

test("startTask sets started_at and status in_progress", () => {
  const { db, t } = setup();
  const r = startTask(db, t.id, "2026-07-01T08:00:00.000Z");
  expect(r.status).toBe("in_progress");
  expect(r.startedAt).toBe("2026-07-01T08:00:00.000Z");
  expect(r.completedAt).toBeNull();
});

test("completeTask sets completed_at and status done", () => {
  const { db, t } = setup();
  startTask(db, t.id, "2026-07-01T08:00:00.000Z");
  const r = completeTask(db, t.id, "2026-07-01T08:10:00.000Z");
  expect(r.status).toBe("done");
  expect(r.completedAt).toBe("2026-07-01T08:10:00.000Z");
  expect(r.startedAt).toBe("2026-07-01T08:00:00.000Z");
});
