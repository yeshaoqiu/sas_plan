import { expect, test } from "vitest";

process.env.DB_PATH = ":memory:";

test("child PATCH then archive then all-list reflects archived", async () => {
  const { POST: createC } = await import("@/app/api/children/route");
  const created = await (await createC(
    new Request("http://x/api/children", { method: "POST", body: JSON.stringify({ name: "小明", grade: 1 }) }),
  )).json();

  const { PATCH } = await import("@/app/api/children/[id]/route");
  const patched = await (await PATCH(
    new Request(`http://x/api/children/${created.id}`, { method: "PATCH", body: JSON.stringify({ name: "小明明", grade: 2, avatar: "🐼" }) }),
    { params: Promise.resolve({ id: String(created.id) }) },
  )).json();
  expect(patched.name).toBe("小明明");

  const { POST: archive } = await import("@/app/api/children/[id]/archive/route");
  await archive(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: String(created.id) }) });

  const { GET } = await import("@/app/api/children/route");
  const active = await (await GET(new Request("http://x/api/children"))).json();
  const all = await (await GET(new Request("http://x/api/children?all=1"))).json();
  expect(active.find((c: { id: number }) => c.id === created.id)).toBeUndefined();
  expect(all.find((c: { id: number }) => c.id === created.id)?.archived).toBe(1);
});
