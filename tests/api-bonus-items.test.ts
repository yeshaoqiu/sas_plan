import { expect, test } from "vitest";

process.env.DB_PATH = ":memory:";

test("bonus-items create/list/patch/archive/all-list", async () => {
  const mod = await import("@/app/api/bonus-items/route");
  // seeded 3 active
  const seeded = await (await mod.GET(new Request("http://x/api/bonus-items"))).json();
  expect(seeded.length).toBe(3);

  const created = await (await mod.POST(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "字迹工整", description: "写得整齐", points: 4, sortOrder: 9 }) }))).json();
  expect(created.name).toBe("字迹工整");
  expect(created.points).toBe(4);

  const idMod = await import("@/app/api/bonus-items/[id]/route");
  const params = { params: Promise.resolve({ id: String(created.id) }) };
  const patched = await (await idMod.PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ name: "字迹工整", description: "写得整齐好看", points: 6, sortOrder: 9 }) }), params)).json();
  expect(patched.points).toBe(6);

  const arch = await import("@/app/api/bonus-items/[id]/archive/route");
  await arch.POST(new Request("http://x", { method: "POST" }), params);
  const active = await (await mod.GET(new Request("http://x/api/bonus-items"))).json();
  const all = await (await mod.GET(new Request("http://x/api/bonus-items?all=1"))).json();
  expect(active.find((b: { id: number }) => b.id === created.id)).toBeUndefined();
  expect(all.find((b: { id: number }) => b.id === created.id)?.active).toBe(0);
});
