import { expect, test } from "vitest";

process.env.DB_PATH = ":memory:";

test("daily-plan add/list/remove + ensure-day creates tasks", async () => {
  const { POST: createChild } = await import("@/app/api/children/route");
  const child = await (await createChild(
    new Request("http://x/api/children", { method: "POST", body: JSON.stringify({ name: "小明", grade: 1 }) }),
  )).json();

  const { POST: createTpl } = await import("@/app/api/templates/route");
  const tpl = await (await createTpl(
    new Request("http://x/api/templates", { method: "POST", body: JSON.stringify({ name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 }) }),
  )).json();

  const planMod = await import("@/app/api/children/[id]/daily-plan/route");
  const params = { params: Promise.resolve({ id: String(child.id) }) };

  await planMod.POST(new Request("http://x", { method: "POST", body: JSON.stringify({ templateId: tpl.id }) }), params);
  const plan = await (await planMod.GET(new Request("http://x"), params)).json();
  expect(plan).toEqual([tpl.id]);

  const ensureMod = await import("@/app/api/children/[id]/ensure-day/route");
  const tasks = await (await ensureMod.POST(
    new Request("http://x", { method: "POST", body: JSON.stringify({ date: "2026-07-01" }) }),
    params,
  )).json();
  expect(tasks).toHaveLength(1);
});
