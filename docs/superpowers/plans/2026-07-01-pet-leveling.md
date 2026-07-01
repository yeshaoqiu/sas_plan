# 养成/等级系统（成长页）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每个孩子一个随累计学习进化的宠物 + 连续打卡，展示在新增的「成长」页。

**Architecture:** 纯函数 `getPetStage` 把累计获得映射到宠物阶段；仓储从现有 `point_entries`/`task_instances` 派生累计获得与连续打卡；growth API 汇总；新增 `/growth` 页 + 导航。无新表。

**Tech Stack:** Next.js 15 App Router, TypeScript, better-sqlite3, Vitest, Tailwind v3。

## Global Constraints

- 不引入新依赖；派生自现有数据，无新表/无迁移；better-sqlite3 同步 API；仓储函数首参 `db`。
- 累计获得 = `SUM(delta) WHERE child_id=? AND delta > 0`（正向流水之和；兑换负向不减；无记录返回 0）。
- 连续打卡口径：锚点 = 今天有已评分任务则今天，否则昨天有则昨天，否则 0；从锚点逐日回溯连续「有已评分任务」的天数。`today` 由调用方传 `YYYY-MM-DD`。
- 宠物阈值表（`lib/pet.ts` 内）：`[0 🥚 蛋, 30 🐣 破壳, 80 🐤 小鸡, 160 🐔 大公鸡, 280 🦚 孔雀, 450 🦅 雄鹰]`。
- TDD（纯函数 + 仓储）；页面 `npx next build` + 截图验证；既有 55 项测试保持通过。

---

## File Structure

- `lib/pet.ts` — 新建：`PET_STAGES` + `getPetStage`。
- `lib/repositories/points.ts` — 修改：加 `getLifetimeEarned`。
- `lib/repositories/growth.ts` — 新建：`getStreak`（+ 内部 `prevDay`）。
- `app/api/children/[id]/growth/route.ts` — 新建：GET。
- `app/growth/page.tsx` — 新建：成长页。
- `app/_components/Nav.tsx` — 修改：加「成长」链接。

---

### Task 1: getPetStage 纯函数

**Files:**
- Create: `lib/pet.ts`
- Test: `tests/pet.test.ts`

**Interfaces:**
- Consumes: 无（纯函数）。
- Produces: `getPetStage(earned: number): { level: number; emoji: string; name: string; curMin: number; nextMin: number | null; toNext: number }`。取 `earned` 满足的最高档；满级 `nextMin=null`、`toNext=0`；否则 `toNext = nextMin - earned`。

- [ ] **Step 1: 写失败测试**

`tests/pet.test.ts`:
```ts
import { expect, test } from "vitest";
import { getPetStage } from "@/lib/pet";

test("level 1 egg at 0", () => {
  const s = getPetStage(0);
  expect(s.level).toBe(1);
  expect(s.emoji).toBe("🥚");
  expect(s.curMin).toBe(0);
  expect(s.nextMin).toBe(30);
  expect(s.toNext).toBe(30);
});

test("picks highest satisfied stage and computes toNext", () => {
  const s = getPetStage(100); // >=80 (🐤) but <160
  expect(s.level).toBe(3);
  expect(s.emoji).toBe("🐤");
  expect(s.curMin).toBe(80);
  expect(s.nextMin).toBe(160);
  expect(s.toNext).toBe(60);
});

test("max level has null nextMin and 0 toNext", () => {
  const s = getPetStage(1000); // >=450
  expect(s.level).toBe(6);
  expect(s.emoji).toBe("🦅");
  expect(s.nextMin).toBeNull();
  expect(s.toNext).toBe(0);
});

test("exact threshold promotes", () => {
  expect(getPetStage(30).emoji).toBe("🐣");
  expect(getPetStage(29).emoji).toBe("🥚");
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/pet.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`lib/pet.ts`:
```ts
export const PET_STAGES = [
  { min: 0, emoji: "🥚", name: "蛋" },
  { min: 30, emoji: "🐣", name: "破壳" },
  { min: 80, emoji: "🐤", name: "小鸡" },
  { min: 160, emoji: "🐔", name: "大公鸡" },
  { min: 280, emoji: "🦚", name: "孔雀" },
  { min: 450, emoji: "🦅", name: "雄鹰" },
] as const;

export function getPetStage(earned: number): {
  level: number;
  emoji: string;
  name: string;
  curMin: number;
  nextMin: number | null;
  toNext: number;
} {
  let idx = 0;
  for (let i = 0; i < PET_STAGES.length; i++) {
    if (earned >= PET_STAGES[i].min) idx = i;
  }
  const stage = PET_STAGES[idx];
  const next = idx + 1 < PET_STAGES.length ? PET_STAGES[idx + 1] : null;
  return {
    level: idx + 1,
    emoji: stage.emoji,
    name: stage.name,
    curMin: stage.min,
    nextMin: next ? next.min : null,
    toNext: next ? next.min - earned : 0,
  };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/pet.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/pet.ts tests/pet.test.ts
git commit -m "feat: add getPetStage pure function"
```

---

### Task 2: getLifetimeEarned

**Files:**
- Modify: `lib/repositories/points.ts`
- Test: `tests/lifetime-earned.test.ts`

**Interfaces:**
- Consumes: `createDb`、`createChild`、`addPointEntry`（现有）。
- Produces: `getLifetimeEarned(db, childId): number`（正向 delta 之和；负向/兑换不计；无记录 0）。

- [ ] **Step 1: 写失败测试**

`tests/lifetime-earned.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { addPointEntry, getLifetimeEarned } from "@/lib/repositories/points";

test("sums only positive deltas; redemptions do not reduce it", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  expect(getLifetimeEarned(db, c.id)).toBe(0);
  addPointEntry(db, { childId: c.id, delta: 15, reason: "完成任务" });
  addPointEntry(db, { childId: c.id, delta: 20, reason: "完成任务" });
  addPointEntry(db, { childId: c.id, delta: -30, reason: "兑换" }); // ignored
  expect(getLifetimeEarned(db, c.id)).toBe(35);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/lifetime-earned.test.ts`
Expected: FAIL（函数未定义）

- [ ] **Step 3: 实现（在 `lib/repositories/points.ts` 追加）**

```ts
export function getLifetimeEarned(db: Database.Database, childId: number): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(delta), 0) AS s FROM point_entries WHERE child_id = ? AND delta > 0")
    .get(childId) as { s: number };
  return row.s;
}
```

- [ ] **Step 4: 运行测试，确认通过；全量**

Run: `npm test -- tests/lifetime-earned.test.ts` → PASS
Run: `npm test` → 全绿。

- [ ] **Step 5: 提交**

```bash
git add lib/repositories/points.ts tests/lifetime-earned.test.ts
git commit -m "feat: add getLifetimeEarned"
```

---

### Task 3: getStreak

**Files:**
- Create: `lib/repositories/growth.ts`
- Test: `tests/streak.test.ts`

**Interfaces:**
- Consumes: `createDb`、`createChild`、`createTemplate`、`assignTask`、`scoreTask`（现有）。
- Produces: `getStreak(db, childId, today: string): number`（§口径）。

- [ ] **Step 1: 写失败测试**

`tests/streak.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask, scoreTask } from "@/lib/repositories/tasks";
import { getStreak } from "@/lib/repositories/growth";

function scoredOn(db: number extends never ? never : any, childId: number, tplId: number, date: string) {
  const t = assignTask(db, { childId, templateId: tplId, date });
  scoreTask(db, t.id, { actualMinutes: 5, bonusItemIds: [], errorCount: 0 });
}

function setup() {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const tpl = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  return { db, c, tpl };
}

test("counts consecutive scored days ending today", () => {
  const { db, c, tpl } = setup();
  scoredOn(db, c.id, tpl.id, "2026-06-29");
  scoredOn(db, c.id, tpl.id, "2026-06-30");
  scoredOn(db, c.id, tpl.id, "2026-07-01");
  expect(getStreak(db, c.id, "2026-07-01")).toBe(3);
});

test("today not done yet -> grace to yesterday", () => {
  const { db, c, tpl } = setup();
  scoredOn(db, c.id, tpl.id, "2026-06-30");
  scoredOn(db, c.id, tpl.id, "2026-07-01");
  // today = 07-02, nothing scored today, yesterday (07-01) yes
  expect(getStreak(db, c.id, "2026-07-02")).toBe(2);
});

test("gap breaks the streak", () => {
  const { db, c, tpl } = setup();
  scoredOn(db, c.id, tpl.id, "2026-06-28");
  scoredOn(db, c.id, tpl.id, "2026-06-30");
  scoredOn(db, c.id, tpl.id, "2026-07-01");
  expect(getStreak(db, c.id, "2026-07-01")).toBe(2); // 06-30,07-01; 06-29 missing
});

test("no recent activity -> 0", () => {
  const { db, c, tpl } = setup();
  scoredOn(db, c.id, tpl.id, "2026-06-20");
  expect(getStreak(db, c.id, "2026-07-01")).toBe(0); // neither today nor yesterday
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/streak.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`lib/repositories/growth.ts`:
```ts
import type Database from "better-sqlite3";

function prevDay(date: string): string {
  const dt = new Date(date + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function getStreak(
  db: Database.Database,
  childId: number,
  today: string,
): number {
  const rows = db
    .prepare("SELECT DISTINCT date FROM task_instances WHERE child_id = ? AND status = 'scored'")
    .all(childId) as { date: string }[];
  const days = new Set(rows.map((r) => r.date));

  const yesterday = prevDay(today);
  let anchor: string | null = null;
  if (days.has(today)) anchor = today;
  else if (days.has(yesterday)) anchor = yesterday;
  if (anchor === null) return 0;

  let count = 0;
  let d: string = anchor;
  while (days.has(d)) {
    count++;
    d = prevDay(d);
  }
  return count;
}
```

- [ ] **Step 4: 运行测试，确认通过；全量**

Run: `npm test -- tests/streak.test.ts` → PASS
Run: `npm test` → 全绿。

- [ ] **Step 5: 提交**

```bash
git add lib/repositories/growth.ts tests/streak.test.ts
git commit -m "feat: add getStreak"
```

---

### Task 4: growth API

**Files:**
- Create: `app/api/children/[id]/growth/route.ts`
- Test: `tests/api-growth.test.ts`

**Interfaces:**
- Consumes: `getDb`、`getLifetimeEarned`、`getStreak`、`getPetStage`。
- Produces: `GET /api/children/[id]/growth?today=YYYY-MM-DD` → `{ earned: number; streak: number; pet: <getPetStage 结果> }`。

- [ ] **Step 1: route**

`app/api/children/[id]/growth/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getLifetimeEarned } from "@/lib/repositories/points";
import { getStreak } from "@/lib/repositories/growth";
import { getPetStage } from "@/lib/pet";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const today = new URL(req.url).searchParams.get("today") ?? "";
  const db = getDb();
  const childId = Number(id);
  const earned = getLifetimeEarned(db, childId);
  const streak = getStreak(db, childId, today);
  return NextResponse.json({ earned, streak, pet: getPetStage(earned) });
}
```

- [ ] **Step 2: 集成测试**

`tests/api-growth.test.ts`:
```ts
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
```

- [ ] **Step 3: 运行测试 + build + 全量**

Run: `npm test -- tests/api-growth.test.ts` → PASS
Run: `npx next build` → 编译通过（新路由出现）。
Run: `npm test` → 全绿。

- [ ] **Step 4: 提交**

```bash
git add app/api/children tests/api-growth.test.ts
git commit -m "feat: growth API (earned + streak + pet stage)"
```

---

### Task 5: 成长页 + 导航

**Files:**
- Create: `app/growth/page.tsx`
- Modify: `app/_components/Nav.tsx`
- 验证：`npx next build` + 截图

**Interfaces:**
- Consumes: `GET /api/children`、`GET /api/children/[id]/growth?today=`。
- Produces: 无。

- [ ] **Step 1: 导航加「成长」**

在 `app/_components/Nav.tsx` 的 `LINKS` 数组中，「奖励商店」之后加一项（顺序：今日清单 / 奖励商店 / 成长 / 记录 / 管理）：
```tsx
  { href: "/growth", label: "成长" },
```
（保持其余项不变。）

- [ ] **Step 2: 新建成长页**

`app/growth/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";

interface Child { id: number; name: string; avatar: string }
interface Pet { level: number; emoji: string; name: string; curMin: number; nextMin: number | null; toNext: number }
interface Growth { earned: number; streak: number; pet: Pet }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function GrowthPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [g, setG] = useState<Growth | null>(null);

  useEffect(() => {
    fetch("/api/children").then((r) => r.json()).then((c: Child[]) => {
      setChildren(c);
      if (c[0]) setChildId(c[0].id);
    });
  }, []);

  useEffect(() => {
    if (!childId) return;
    fetch(`/api/children/${childId}/growth?today=${today()}`).then((r) => r.json()).then(setG);
  }, [childId]);

  const pct = g && g.pet.nextMin !== null
    ? Math.min(100, Math.round(((g.earned - g.pet.curMin) / (g.pet.nextMin - g.pet.curMin)) * 100))
    : 100;

  return (
    <div className="space-y-6">
      <select value={childId ?? ""} onChange={(e) => setChildId(+e.target.value)} className="input">
        {children.map((c) => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
      </select>

      {g && (
        <div className="card flex flex-col items-center gap-3 py-8">
          <div className="text-7xl">{g.pet.emoji}</div>
          <div className="text-xl font-bold">Lv.{g.pet.level} {g.pet.name}</div>
          <div className="w-full max-w-sm">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>累计获得 {g.earned}⭐</span>
              <span>{g.pet.nextMin === null ? "已满级" : `距下一级还差 ${g.pet.toNext}⭐`}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-amber-100">
              <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="chip bg-orange-100 text-orange-700 text-base">🔥 连续 {g.streak} 天</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: build + 全量测试**

Run: `npx next build` → 编译通过（`/growth` 出现）。
Run: `npm test` → 全绿。

- [ ] **Step 4: 浏览器验证**

Run: `npm run dev`，打开 `/growth`
Expected: 选孩子显示大宠物 emoji + Lv.N 阶段名 + 进度条（累计获得/距下一级）+ 🔥连续天数；切换孩子数据更新；导航出现「成长」。

- [ ] **Step 5: 提交**

```bash
git add app/growth/page.tsx app/_components/Nav.tsx
git commit -m "feat: add growth page (pet + level + streak) and nav link"
```

---

## Self-Review

**Spec coverage（对照 2026-07-01-pet-leveling-design.md）：**
- getPetStage 纯函数 + 阈值表 → Task 1 ✓
- 累计获得（正向流水之和，兑换不减）→ Task 2 ✓
- 连续打卡口径（锚点今天/昨天宽限、逐日回溯）→ Task 3 ✓
- growth API（earned + streak + pet）→ Task 4 ✓
- 成长页（大宠物 + Lv + 进度条 + 🔥连续 + 累计获得）+ 导航「成长」→ Task 5 ✓
- 无新表、派生数据、TDD、既有测试保持 → 各任务约束 ✓
- 排行榜/周报/规则/AI → 其它里程碑，不在此计划。

**Placeholder scan：** 无 TBD/TODO；每步含完整代码与命令。（streak 测试中的 `scoredOn` 辅助的 `db` 参数类型写法仅为占位避免 any-lint，可直接用 `db: ReturnType<typeof createDb>`——实现者按可编译方式微调，不改语义。）

**Type consistency：** `getPetStage` 返回结构（Task 1）在 API（Task 4）与页面 `Pet`/`Growth` 类型（Task 5）一致（level/emoji/name/curMin/nextMin/toNext）；`getLifetimeEarned(db,childId)`、`getStreak(db,childId,today)` 名称与签名在仓储（Task 2/3）、API（Task 4）一致；growth 返回 `{earned,streak,pet}` 与页面消费一致。

**注：** streak 测试里的 `scoredOn` 辅助函数 `db` 形参类型，实现者应写成 `db: ReturnType<typeof createDb>`（可编译），语义不变。`app/_components/Nav.tsx`、`lib/repositories/points.ts` 为既有文件，按同语义位置增改。