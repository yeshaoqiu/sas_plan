# 记录 / 进度视图实现计划 — Plan 2/2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加按天回看任务、当日完成进度条、兑换历史、积分流水四个记录/进度视图。

**Architecture:** 仓储层加只读查询（`listRedemptions`、`getDayProgress`），API 暴露对应 GET，今日清单页加进度条，新增 `/records` 页按孩子展示三块记录；按天回看复用既有 `GET /api/tasks`。沿用童趣主题共享类。

**Tech Stack:** Next.js 15 App Router, TypeScript, better-sqlite3, Vitest, Tailwind v3。

## Global Constraints

- 不引入新依赖；better-sqlite3 同步 API；仓储函数首参 `db`；snake_case ↔ camelCase 显式映射。
- 当日进度口径：`total` = 当天该孩子 `task_instances` 行数；`scored` = 其中 `status='scored'` 行数；`pointsEarned` = 当天该孩子 `status='scored'` 任务的 `points_awarded` 之和（取自 `task_instances`，不另算流水时间戳）。
- 兑换历史 = `point_entries` 中 `reward_id IS NOT NULL`，按 id 倒序；展示用 `reason`（已含「兑换: 奖励名」）、`delta`、`createdAt`。
- 积分流水 = 既有 `listEntries`（全部加/扣/兑换，按 id 倒序）。
- 历史里要能显示已归档模板/奖励的名字：`/records` 拉模板用 `?all=1`；兑换历史靠 `reason` 文本不依赖奖励表。
- 既有 25 项测试须保持通过；UI 以 `npx next build` 通过 + 截图验证；新仓储逻辑走 TDD。

---

## File Structure

- `lib/repositories/points.ts` — 修改：加 `listRedemptions(db, childId)`。（`listEntries` 已存在。）
- `lib/repositories/tasks.ts` — 修改：加 `getDayProgress(db, childId, date)`。
- `app/api/children/[id]/redemptions/route.ts` — 新建：GET 兑换历史。
- `app/api/children/[id]/entries/route.ts` — 新建：GET 积分流水。
- `app/api/children/[id]/progress/route.ts` — 新建：GET `?date=` 当日进度。
- `app/page.tsx` — 修改：顶部加当日进度条。
- `app/records/page.tsx` — 新建：记录页（按天回看 / 兑换历史 / 积分流水）。
- `app/layout.tsx` — 修改：导航加「记录」链接。

---

### Task 1: 兑换历史查询 listRedemptions

**Files:**
- Modify: `lib/repositories/points.ts`
- Test: `tests/redemptions.test.ts`

**Interfaces:**
- Consumes: `createDb`、`createChild`、`createReward`、`redeemReward`、`addPointEntry`、`PointEntry`。
- Produces: `listRedemptions(db: Database.Database, childId: number): PointEntry[]`（仅 `reward_id IS NOT NULL`，按 id 倒序）。

- [ ] **Step 1: 写失败测试**

`tests/redemptions.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createReward, redeemReward } from "@/lib/repositories/rewards";
import { addPointEntry, listRedemptions } from "@/lib/repositories/points";

test("listRedemptions returns only reward redemptions, newest first", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  addPointEntry(db, { childId: c.id, delta: 200, reason: "完成任务: 写字" }); // not a redemption
  const r1 = createReward(db, { name: "看动画", cost: 30 });
  const r2 = createReward(db, { name: "出游", cost: 80 });
  redeemReward(db, { childId: c.id, rewardId: r1.id });
  redeemReward(db, { childId: c.id, rewardId: r2.id });

  const list = listRedemptions(db, c.id);
  expect(list).toHaveLength(2);
  // newest first (出游 redeemed last)
  expect(list[0].reason).toBe("兑换: 出游");
  expect(list[0].delta).toBe(-80);
  expect(list[0].rewardId).toBe(r2.id);
  expect(list[1].reason).toBe("兑换: 看动画");
  // the non-redemption entry is excluded
  expect(list.every((e) => e.rewardId !== null)).toBe(true);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/redemptions.test.ts`
Expected: FAIL（`listRedemptions` 未定义）

- [ ] **Step 3: 实现（在 `lib/repositories/points.ts` 追加，复用其内部 `Row`/`toEntry`）**

在 `lib/repositories/points.ts` 末尾新增导出函数（该文件已有 `interface Row`、`toEntry` 与 `PointEntry` 导入；直接复用）：
```ts
export function listRedemptions(
  db: Database.Database,
  childId: number,
): PointEntry[] {
  const rows = db
    .prepare(
      "SELECT * FROM point_entries WHERE child_id = ? AND reward_id IS NOT NULL ORDER BY id DESC",
    )
    .all(childId) as Row[];
  return rows.map(toEntry);
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/redemptions.test.ts`
Expected: PASS

- [ ] **Step 5: 全量测试**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 6: 提交**

```bash
git add lib/repositories/points.ts tests/redemptions.test.ts
git commit -m "feat: add listRedemptions query"
```

---

### Task 2: 当日进度 getDayProgress

**Files:**
- Modify: `lib/repositories/tasks.ts`
- Test: `tests/day-progress.test.ts`

**Interfaces:**
- Consumes: `createDb`、`createChild`、`createTemplate`、`assignTask`、`scoreTask`。
- Produces: `getDayProgress(db: Database.Database, childId: number, date: string): { total: number; scored: number; pointsEarned: number }`。

- [ ] **Step 1: 写失败测试**

`tests/day-progress.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask, scoreTask, getDayProgress } from "@/lib/repositories/tasks";

test("getDayProgress counts total/scored and sums points for the day", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const tpl = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  const t1 = assignTask(db, { childId: c.id, templateId: tpl.id, date: "2026-06-30" });
  assignTask(db, { childId: c.id, templateId: tpl.id, date: "2026-06-30" }); // unscored
  assignTask(db, { childId: c.id, templateId: tpl.id, date: "2026-06-29" }); // other day

  scoreTask(db, t1.id, { actualMinutes: 5, focused: true, usedScaffold: false, didCheck: false, errorCount: 0 }); // 10 + 5 = 15

  const p = getDayProgress(db, c.id, "2026-06-30");
  expect(p.total).toBe(2);
  expect(p.scored).toBe(1);
  expect(p.pointsEarned).toBe(15);
});

test("getDayProgress is zero for a day with no tasks", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  expect(getDayProgress(db, c.id, "2026-06-30")).toEqual({ total: 0, scored: 0, pointsEarned: 0 });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/day-progress.test.ts`
Expected: FAIL（`getDayProgress` 未定义）

- [ ] **Step 3: 实现（在 `lib/repositories/tasks.ts` 末尾追加）**

```ts
export function getDayProgress(
  db: Database.Database,
  childId: number,
  date: string,
): { total: number; scored: number; pointsEarned: number } {
  const total = (
    db
      .prepare("SELECT COUNT(*) AS n FROM task_instances WHERE child_id = ? AND date = ?")
      .get(childId, date) as { n: number }
  ).n;
  const scored = (
    db
      .prepare("SELECT COUNT(*) AS n FROM task_instances WHERE child_id = ? AND date = ? AND status = 'scored'")
      .get(childId, date) as { n: number }
  ).n;
  const pointsEarned = (
    db
      .prepare("SELECT COALESCE(SUM(points_awarded), 0) AS s FROM task_instances WHERE child_id = ? AND date = ? AND status = 'scored'")
      .get(childId, date) as { s: number }
  ).s;
  return { total, scored, pointsEarned };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/day-progress.test.ts`
Expected: PASS

- [ ] **Step 5: 全量测试**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 6: 提交**

```bash
git add lib/repositories/tasks.ts tests/day-progress.test.ts
git commit -m "feat: add getDayProgress query"
```

---

### Task 3: 记录/进度 API

**Files:**
- Create: `app/api/children/[id]/redemptions/route.ts`
- Create: `app/api/children/[id]/entries/route.ts`
- Create: `app/api/children/[id]/progress/route.ts`
- Test: `tests/api-records.test.ts`

**Interfaces:**
- Consumes: `getDb`、`listRedemptions`、`listEntries`、`getDayProgress`。
- Produces:
  - `GET /api/children/[id]/redemptions` → `PointEntry[]`
  - `GET /api/children/[id]/entries` → `PointEntry[]`
  - `GET /api/children/[id]/progress?date=YYYY-MM-DD` → `{ total, scored, pointsEarned }`
- 注：按天回看任务复用既有 `GET /api/tasks?childId=&date=`（无需新端点）。

- [ ] **Step 1: 兑换历史端点**

`app/api/children/[id]/redemptions/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listRedemptions } from "@/lib/repositories/points";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(listRedemptions(getDb(), Number(id)));
}
```

- [ ] **Step 2: 积分流水端点**

`app/api/children/[id]/entries/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listEntries } from "@/lib/repositories/points";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(listEntries(getDb(), Number(id)));
}
```

- [ ] **Step 3: 当日进度端点**

`app/api/children/[id]/progress/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getDayProgress } from "@/lib/repositories/tasks";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const date = new URL(req.url).searchParams.get("date") ?? "";
  return NextResponse.json(getDayProgress(getDb(), Number(id), date));
}
```

- [ ] **Step 4: 集成测试**

`tests/api-records.test.ts`:
```ts
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
```

- [ ] **Step 5: 运行测试**

Run: `npm test -- tests/api-records.test.ts`
Expected: PASS

- [ ] **Step 6: build + 全量测试**

Run: `npx next build`
Expected: 编译通过（新路由出现）。

Run: `npm test`
Expected: 全绿。

- [ ] **Step 7: 提交**

```bash
git add app/api/children tests/api-records.test.ts
git commit -m "feat: records/progress API endpoints"
```

---

### Task 4: 今日清单页当日进度条

**Files:**
- Modify: `app/page.tsx`
- 验证：`npx next build` + 截图

**Interfaces:**
- Consumes: `GET /api/children/[id]/progress?date=`。
- Produces: 无。

- [ ] **Step 1: 在今日页加进度状态与拉取**

在 `app/page.tsx` 组件内（已有 `childId`、`date`、`loadTasks` 等）新增 progress 状态，并在 childId/date 变化时与任务一起刷新。具体：
- 顶部状态区加：
```tsx
const [progress, setProgress] = useState<{ total: number; scored: number; pointsEarned: number }>({ total: 0, scored: 0, pointsEarned: 0 });
```
- 在既有 `loadTasks` 函数体末尾追加进度拉取（保证派发/评分后进度同步刷新）：
```tsx
    const p = await fetch(`/api/children/${childId}/progress?date=${date}`).then((r) => r.json());
    setProgress(p);
```
  即 `loadTasks` 变为：
```tsx
  async function loadTasks() {
    if (!childId) return;
    const t = await fetch(`/api/tasks?childId=${childId}&date=${date}`).then((r) => r.json());
    setTasks(t);
    const p = await fetch(`/api/children/${childId}/progress?date=${date}`).then((r) => r.json());
    setProgress(p);
  }
```

- [ ] **Step 2: 在选择器下方渲染进度条**

在孩子/日期选择器那个 `<div>` 之后、「派发任务」区块之前，插入进度条块：
```tsx
      <div className="card">
        <div className="mb-1 flex items-center justify-between text-sm font-medium">
          <span>当日进度</span>
          <span className="text-amber-600">已完成 {progress.scored}/{progress.total} · 获得 {progress.pointsEarned}⭐</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-amber-100">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${progress.total ? Math.round((progress.scored / progress.total) * 100) : 0}%` }}
          />
        </div>
      </div>
```

- [ ] **Step 3: build + 全量测试**

Run: `npx next build`
Expected: 编译通过。

Run: `npm test`
Expected: 全绿（UI 不影响测试）。

- [ ] **Step 4: 浏览器验证**

Run: `npm run dev`，打开 `/`，选孩子、派发并评分若干任务
Expected: 进度条随评分推进，文案显示「已完成 X/Y · 获得 N⭐」。

- [ ] **Step 5: 提交**

```bash
git add app/page.tsx
git commit -m "feat: add day progress bar to today page"
```

---

### Task 5: 记录页 /records + 导航

**Files:**
- Create: `app/records/page.tsx`
- Modify: `app/layout.tsx`
- 验证：`npx next build` + 截图

**Interfaces:**
- Consumes: `GET /api/children`、`GET /api/templates?all=1`、`GET /api/tasks?childId=&date=`、`GET /api/children/[id]/redemptions`、`GET /api/children/[id]/entries`。
- Produces: 无。

- [ ] **Step 1: 导航加「记录」链接**

在 `app/layout.tsx` 的 `<nav>` 中，「奖励商店」与「管理」之间插入：
```tsx
          <a href="/records" className="rounded-full px-3 py-1.5 font-medium hover:bg-amber-100">记录</a>
```
（保持其余导航项不变。）

- [ ] **Step 2: 新建记录页**

`app/records/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";

interface Child { id: number; name: string; avatar: string }
interface Template { id: number; name: string }
interface Task { id: number; templateId: number; status: string; pointsAwarded: number | null }
interface Entry { id: number; delta: number; reason: string; createdAt: string }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(ts: string) {
  return ts.slice(0, 16).replace("T", " ");
}

export default function Records() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [redemptions, setRedemptions] = useState<Entry[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    fetch("/api/children").then((r) => r.json()).then((c: Child[]) => {
      setChildren(c);
      if (c[0]) setChildId(c[0].id);
    });
    fetch("/api/templates?all=1").then((r) => r.json()).then(setTemplates);
  }, []);

  useEffect(() => {
    if (!childId) return;
    fetch(`/api/tasks?childId=${childId}&date=${date}`).then((r) => r.json()).then(setTasks);
  }, [childId, date]);

  useEffect(() => {
    if (!childId) return;
    fetch(`/api/children/${childId}/redemptions`).then((r) => r.json()).then(setRedemptions);
    fetch(`/api/children/${childId}/entries`).then((r) => r.json()).then(setEntries);
  }, [childId]);

  const tplName = (id: number) => templates.find((t) => t.id === id)?.name ?? "?";

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <select value={childId ?? ""} onChange={(e) => setChildId(+e.target.value)} className="input">
          {children.map((c) => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
        </select>
      </div>

      <section>
        <div className="mb-2 flex items-center gap-3">
          <h2 className="font-semibold">按天回看任务</h2>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="card flex items-center justify-between">
              <span>{tplName(t.templateId)}</span>
              {t.status === "scored"
                ? <span className="chip bg-emerald-100 text-emerald-700">已评分 +{t.pointsAwarded}</span>
                : <span className="chip bg-slate-100 text-slate-500">未完成</span>}
            </li>
          ))}
          {tasks.length === 0 && <li className="text-slate-500">这一天没有任务。</li>}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">兑换历史</h2>
        <ul className="space-y-2">
          {redemptions.map((e) => (
            <li key={e.id} className="card flex items-center justify-between">
              <span>{e.reason}</span>
              <span className="text-rose-500">{e.delta}⭐ · {fmt(e.createdAt)}</span>
            </li>
          ))}
          {redemptions.length === 0 && <li className="text-slate-500">还没有兑换记录。</li>}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">积分流水</h2>
        <ul className="space-y-1 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
              <span>{e.reason}</span>
              <span className={e.delta >= 0 ? "text-emerald-600" : "text-rose-500"}>
                {e.delta >= 0 ? `+${e.delta}` : e.delta}⭐ · {fmt(e.createdAt)}
              </span>
            </li>
          ))}
          {entries.length === 0 && <li className="text-slate-500">还没有积分记录。</li>}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: build + 全量测试**

Run: `npx next build`
Expected: 编译通过（出现 `/records` 路由）。

Run: `npm test`
Expected: 全绿。

- [ ] **Step 4: 浏览器验证**

Run: `npm run dev`，打开 `/records`
Expected: 可切换孩子；按天回看显示当天任务及完成/评分状态；兑换历史、积分流水按时间倒序显示。导航出现「记录」。

- [ ] **Step 5: 提交**

```bash
git add app/records/page.tsx app/layout.tsx
git commit -m "feat: add records page (history & ledger) + nav link"
```

---

## Self-Review

**Spec coverage（对照 2026-06-30-admin-crud-and-records-design.md §5、§6 的记录/进度部分）：**
- 今日清单页当日进度条（已完成 X/Y · 获得 N⭐）→ Task 4 ✓
- 按天回看任务（复用 GET /api/tasks）→ Task 5 ✓
- 兑换历史（reward_id IS NOT NULL）→ Task 1（查询）+ Task 3（API）+ Task 5（UI）✓
- 积分流水（listEntries）→ Task 3（API）+ Task 5（UI）✓
- getDayProgress 口径（total/scored/pointsEarned）→ Task 2 ✓
- /records 页 + 导航「记录」→ Task 5 ✓
- 历史显示已归档模板名（?all=1）→ Task 5（拉模板用 all=1）✓
- 管理端 CRUD → Plan 1/2（已完成），不在此计划。

**Placeholder scan：** 无 TBD/TODO；每步含完整代码与命令。

**Type consistency：** `getDayProgress` 返回 `{total,scored,pointsEarned}` 在 Task 2 定义、Task 3 API 透传、Task 4 进度条消费一致；`listRedemptions`/`listEntries` 返回 `PointEntry[]`，UI 用 `delta/reason/createdAt`（camelCase，与 `toEntry` 映射一致）；新端点路径 `/api/children/[id]/{redemptions,entries,progress}` 在 Task 3 定义、Task 5/Task 4 调用一致。

**注：** `app/page.tsx`、`app/layout.tsx` 已历经多次主题/功能修改，实现者须读取实际文件后按"同语义位置"插入（loadTasks 函数体、选择器 div 之后、nav 链接之间），不要凭记忆整体替换。
