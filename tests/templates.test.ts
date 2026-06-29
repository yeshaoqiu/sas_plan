import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createTemplate, listTemplates, getTemplate } from "@/lib/repositories/templates";

test("create and list templates", () => {
  const db = createDb(":memory:");
  const t = createTemplate(db, {
    name: "认真写 5 个字",
    subject: "writing",
    defaultMinutes: 5,
    basePoints: 10,
  });
  expect(t.id).toBeGreaterThan(0);
  expect(t.subject).toBe("writing");
  expect(listTemplates(db)).toHaveLength(1);
  expect(getTemplate(db, t.id)?.basePoints).toBe(10);
});
