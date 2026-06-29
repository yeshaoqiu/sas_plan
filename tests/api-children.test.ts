import { expect, test } from "vitest";

process.env.DB_PATH = ":memory:";

test("children API GET/POST", async () => {
  const { GET, POST } = await import("@/app/api/children/route");
  const postRes = await POST(
    new Request("http://x/api/children", {
      method: "POST",
      body: JSON.stringify({ name: "小明", grade: 1 }),
    }),
  );
  const created = await postRes.json();
  expect(created.name).toBe("小明");

  const getRes = await GET();
  const list = await getRes.json();
  expect(list.length).toBeGreaterThanOrEqual(1);
});
