import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import {
  createTemplate, listTemplates, listAllTemplates, getTemplate,
  updateTemplate, archiveTemplate, restoreTemplate,
} from "@/lib/repositories/templates";

const base = { name: "写字", subject: "writing" as const, defaultMinutes: 5, basePoints: 10 };

test("update changes fields incl. subject and basePoints", () => {
  const db = createDb(":memory:");
  const t = createTemplate(db, base);
  const u = updateTemplate(db, t.id, { name: "口算", subject: "math", defaultMinutes: 8, basePoints: 12 });
  expect(u.name).toBe("口算");
  expect(u.subject).toBe("math");
  expect(u.basePoints).toBe(12);
});

test("archive hides from listTemplates, kept in listAllTemplates; getTemplate still finds it", () => {
  const db = createDb(":memory:");
  const t = createTemplate(db, base);
  archiveTemplate(db, t.id);
  expect(listTemplates(db)).toHaveLength(0);
  expect(listAllTemplates(db)).toHaveLength(1);
  expect(getTemplate(db, t.id)?.archived).toBe(1);
  restoreTemplate(db, t.id);
  expect(listTemplates(db)).toHaveLength(1);
});
