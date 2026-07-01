import { expect, test } from "vitest";

process.env.DB_PATH = ":memory:";

test("start then complete transitions status", async () => {
  const { POST: createChild } = await import("@/app/api/children/route");
  const child = await (await createChild(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "小明", grade: 1 }) }))).json();
  const { POST: createTpl } = await import("@/app/api/templates/route");
  const tpl = await (await createTpl(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 }) }))).json();
  const { POST: assign } = await import("@/app/api/tasks/route");
  const task = await (await assign(new Request("http://x", { method: "POST", body: JSON.stringify({ childId: child.id, templateId: tpl.id, date: "2026-07-01" }) }))).json();

  const params = { params: Promise.resolve({ id: String(task.id) }) };
  const { POST: start } = await import("@/app/api/tasks/[id]/start/route");
  const started = await (await start(new Request("http://x", { method: "POST" }), params)).json();
  expect(started.status).toBe("in_progress");
  expect(started.startedAt).not.toBeNull();

  const { POST: complete } = await import("@/app/api/tasks/[id]/complete/route");
  const done = await (await complete(new Request("http://x", { method: "POST" }), params)).json();
  expect(done.status).toBe("done");
  expect(done.completedAt).not.toBeNull();
});
