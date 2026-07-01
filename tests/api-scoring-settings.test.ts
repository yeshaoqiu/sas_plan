import { expect, test } from "vitest";

process.env.DB_PATH = ":memory:";

test("scoring-settings GET defaults then PATCH persists", async () => {
  const { GET, PATCH } = await import("@/app/api/scoring-settings/route");
  const def = await (await GET()).json();
  expect(def).toEqual({ onTimeBonus: 3, errorPenalty: 2, minPoints: 1 });

  const upd = await (await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ onTimeBonus: 5, errorPenalty: 1, minPoints: 2 }) }))).json();
  expect(upd).toEqual({ onTimeBonus: 5, errorPenalty: 1, minPoints: 2 });

  const again = await (await GET()).json();
  expect(again).toEqual({ onTimeBonus: 5, errorPenalty: 1, minPoints: 2 });
});
