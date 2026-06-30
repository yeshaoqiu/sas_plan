import { expect, test } from "vitest";

process.env.DB_PATH = ":memory:";

test("progress endpoint returns counts for a child/day", async () => {
  const { POST: createChild } = await import("@/app/api/children/route");
  const child = await (await createChild(
    new Request("http://x/api/children", { method: "POST", body: JSON.stringify({ name: "小明", grade: 1 }) }),
  )).json();

  const { GET } = await import("@/app/api/children/[id]/progress/route");
  const res = await GET(
    new Request(`http://x/api/children/${child.id}/progress?date=2026-06-30`),
    { params: Promise.resolve({ id: String(child.id) }) },
  );
  const p = await res.json();
  expect(p).toEqual({ total: 0, scored: 0, pointsEarned: 0 });
});

test("redemptions endpoint returns an array", async () => {
  const { POST: createChild } = await import("@/app/api/children/route");
  const child = await (await createChild(
    new Request("http://x/api/children", { method: "POST", body: JSON.stringify({ name: "小红", grade: 2 }) }),
  )).json();

  const { GET } = await import("@/app/api/children/[id]/redemptions/route");
  const res = await GET(
    new Request("http://x"),
    { params: Promise.resolve({ id: String(child.id) }) },
  );
  expect(Array.isArray(await res.json())).toBe(true);
});
