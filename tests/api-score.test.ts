import { expect, test } from "vitest";

process.env.DB_PATH = ":memory:";

test("score route computes points from bonusItemIds + on-time", async () => {
  const { POST: createChild } = await import("@/app/api/children/route");
  const child = await (await createChild(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "小明", grade: 1 }) }))).json();
  const { POST: createTpl } = await import("@/app/api/templates/route");
  const tpl = await (await createTpl(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 }) }))).json();
  const { POST: assign } = await import("@/app/api/tasks/route");
  const task = await (await assign(new Request("http://x", { method: "POST", body: JSON.stringify({ childId: child.id, templateId: tpl.id, date: "2026-07-01" }) }))).json();

  const { POST: score } = await import("@/app/api/tasks/[id]/score/route");
  const scored = await (await score(
    new Request("http://x", { method: "POST", body: JSON.stringify({ actualMinutes: 5, bonusItemIds: [], errorCount: 0 }) }),
    { params: Promise.resolve({ id: String(task.id) }) },
  )).json();
  // base 10 + on-time 3 = 13
  expect(scored.pointsAwarded).toBe(13);
  expect(scored.status).toBe("scored");
});
