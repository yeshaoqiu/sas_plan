import { expect, test } from "vitest";

process.env.DB_PATH = ":memory:";

test("growth endpoint returns earned + streak + pet", async () => {
  const { POST: createChild } = await import("@/app/api/children/route");
  const child = await (await createChild(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "小明", grade: 1 }) }))).json();
  const { POST: createTpl } = await import("@/app/api/templates/route");
  const tpl = await (await createTpl(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 }) }))).json();
  const { POST: assign } = await import("@/app/api/tasks/route");
  const task = await (await assign(new Request("http://x", { method: "POST", body: JSON.stringify({ childId: child.id, templateId: tpl.id, date: "2026-07-01" }) }))).json();
  const { POST: score } = await import("@/app/api/tasks/[id]/score/route");
  // base 10 + on-time 3 = 13 earned
  await score(new Request("http://x", { method: "POST", body: JSON.stringify({ actualMinutes: 5, bonusItemIds: [], errorCount: 0 }) }), { params: Promise.resolve({ id: String(task.id) }) });

  const { GET } = await import("@/app/api/children/[id]/growth/route");
  const res = await GET(new Request("http://x/api/children/1/growth?today=2026-07-01"), { params: Promise.resolve({ id: String(child.id) }) });
  const g = await res.json();
  expect(g.earned).toBe(13);
  expect(g.streak).toBe(1);
  expect(g.pet.level).toBe(1); // 13 < 30 → 🥚
  expect(g.pet.emoji).toBe("🥚");
});
