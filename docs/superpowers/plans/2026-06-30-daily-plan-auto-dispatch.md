# 每日计划 + 自动派发 实现计划 — Plan 1/2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每个孩子可配置每日任务计划，打开应用时（所选日期≥今天且当天无任务）按计划自动生成清单；手动派发保留。

**Architecture:** 新表 `daily_plan(child_id, template_id)`（经 `CREATE TABLE IF NOT EXISTS` 自动建于新库与既有库）。仓储 `dailyPlan.ts` 管理计划，`tasks.ts` 加 `ensureDailyTasks`（幂等、跳过归档模板）。API 暴露计划增删查与 `ensure-day`。/manage 加「每日计划」配置区；今日页打开时对未来/当天调用 ensure-day。

**Tech Stack:** Next.js 15 App Router, TypeScript, better-sqlite3, Vitest, Tailwind v3。

## Global Constraints

- 不引入新依赖；better-sqlite3 同步 API；仓储函数首参 `db`。
- `daily_plan` 用 `CREATE TABLE IF NOT EXISTS` 加入 `schema.sql`——`db.exec(schema)` 每次打开都跑，既有库会自动补建该表，无需 ALTER。
- `ensureDailyTasks(db, childId, date)`：当天已有任意 task_instances → 不创建（幂等）；否则按该孩子 daily_plan 中**未归档**模板各建一条 `pending`；计划为空 → 不创建。
- 自动派发仅在**所选日期 ≥ 今天（本地）**时触发；过去日期不补。
- 手动「派发任务」保留；与自动并存（自动只在当天零任务时生成）。
- TDD（仓储）；UI 以 `npx next build` 通过 + 截图验证；既有 30 项测试保持通过。

---

## File Structure

- `lib/schema.sql` — 修改：加 `daily_plan` 表。
- `lib/repositories/dailyPlan.ts` — 新建：`listDailyPlan`/`addToDailyPlan`/`removeFromDailyPlan`。
- `lib/repositories/tasks.ts` — 修改：加 `ensureDailyTasks`。
- `app/api/children/[id]/daily-plan/route.ts` — 新建：GET/POST/DELETE。
- `app/api/children/[id]/ensure-day/route.ts` — 新建：POST。
- `app/manage/page.tsx` — 修改：加「每日计划」区。
- `app/page.tsx` — 修改：加载时对 date≥今天调 ensure-day。

---

### Task 1: daily_plan 表

**Files:**
- Modify: `lib/schema.sql`
- Test: `tests/daily-plan-schema.test.ts`

**Interfaces:**
- Consumes: `createDb`。
- Produces: `daily_plan(id, child_id, template_id)` 表存在于新库与（重新打开的）既有库。

- [ ] **Step 1: schema 加表**

在 `lib/schema.sql` 末尾追加：
```sql
CREATE TABLE IF NOT EXISTS daily_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id),
  template_id INTEGER NOT NULL REFERENCES task_templates(id)
);
```

- [ ] **Step 2: 写失败测试**

`tests/daily-plan-schema.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";

test("daily_plan table exists", () => {
  const db = createDb(":memory:");
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='daily_plan'")
    .get() as { name: string } | undefined;
  expect(row?.name).toBe("daily_plan");
});
```

- [ ] **Step 3: 运行测试**

Run: `npm test -- tests/daily-plan-schema.test.ts`
Expected: 先确认 RED（若 schema 未改），改后 PASS。（实现已在 Step 1 完成，本步直接 PASS 即可。）

- [ ] **Step 4: 全量测试**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 5: 提交**

```bash
git add lib/schema.sql tests/daily-plan-schema.test.ts
git commit -m "feat: add daily_plan table"
```

---

### Task 2: 每日计划仓储

**Files:**
- Create: `lib/repositories/dailyPlan.ts`
- Test: `tests/daily-plan.test.ts`

**Interfaces:**
- Consumes: `createDb`、`createChild`、`createTemplate`。
- Produces:
  - `listDailyPlan(db, childId): number[]`（templateId 数组，按插入序）
  - `addToDailyPlan(db, childId, templateId): void`（重复不再插）
  - `removeFromDailyPlan(db, childId, templateId): void`

- [ ] **Step 1: 写失败测试**

`tests/daily-plan.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { listDailyPlan, addToDailyPlan, removeFromDailyPlan } from "@/lib/repositories/dailyPlan";

function setup() {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const t1 = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  const t2 = createTemplate(db, { name: "口算", subject: "math", defaultMinutes: 8, basePoints: 10 });
  return { db, c, t1, t2 };
}

test("add/list/remove daily plan; add is idempotent", () => {
  const { db, c, t1, t2 } = setup();
  expect(listDailyPlan(db, c.id)).toEqual([]);
  addToDailyPlan(db, c.id, t1.id);
  addToDailyPlan(db, c.id, t2.id);
  addToDailyPlan(db, c.id, t1.id); // duplicate ignored
  expect(listDailyPlan(db, c.id)).toEqual([t1.id, t2.id]);
  removeFromDailyPlan(db, c.id, t1.id);
  expect(listDailyPlan(db, c.id)).toEqual([t2.id]);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/daily-plan.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`lib/repositories/dailyPlan.ts`:
```ts
import type Database from "better-sqlite3";

export function listDailyPlan(db: Database.Database, childId: number): number[] {
  const rows = db
    .prepare("SELECT template_id AS tid FROM daily_plan WHERE child_id = ? ORDER BY id")
    .all(childId) as { tid: number }[];
  return rows.map((r) => r.tid);
}

export function addToDailyPlan(
  db: Database.Database,
  childId: number,
  templateId: number,
): void {
  const exists = db
    .prepare("SELECT 1 FROM daily_plan WHERE child_id = ? AND template_id = ?")
    .get(childId, templateId);
  if (!exists) {
    db.prepare("INSERT INTO daily_plan (child_id, template_id) VALUES (?, ?)").run(
      childId,
      templateId,
    );
  }
}

export function removeFromDailyPlan(
  db: Database.Database,
  childId: number,
  templateId: number,
): void {
  db.prepare("DELETE FROM daily_plan WHERE child_id = ? AND template_id = ?").run(
    childId,
    templateId,
  );
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/daily-plan.test.ts`
Expected: PASS

- [ ] **Step 5: 全量测试 + 提交**

Run: `npm test` → 全绿。
```bash
git add lib/repositories/dailyPlan.ts tests/daily-plan.test.ts
git commit -m "feat: add daily plan repository"
```

---

### Task 3: ensureDailyTasks（自动派发）

**Files:**
- Modify: `lib/repositories/tasks.ts`
- Test: `tests/ensure-daily.test.ts`

**Interfaces:**
- Consumes: 既有 `listTasks`、`assignTask`（同文件）；`daily_plan` 表；`createChild`/`createTemplate`/`addToDailyPlan`/`archiveTemplate`（测试用）。
- Produces: `ensureDailyTasks(db, childId, date): TaskInstance[]`——当天已有任务则原样返回；否则按计划中未归档模板各建一条 pending，返回当天任务列表。

- [ ] **Step 1: 写失败测试**

`tests/ensure-daily.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate, archiveTemplate } from "@/lib/repositories/templates";
import { addToDailyPlan } from "@/lib/repositories/dailyPlan";
import { ensureDailyTasks, listTasks, assignTask } from "@/lib/repositories/tasks";

function setup() {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const t1 = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  const t2 = createTemplate(db, { name: "口算", subject: "math", defaultMinutes: 8, basePoints: 10 });
  return { db, c, t1, t2 };
}

test("creates one task per active plan template when day is empty", () => {
  const { db, c, t1, t2 } = setup();
  addToDailyPlan(db, c.id, t1.id);
  addToDailyPlan(db, c.id, t2.id);
  const created = ensureDailyTasks(db, c.id, "2026-07-01");
  expect(created).toHaveLength(2);
  expect(listTasks(db, c.id, "2026-07-01")).toHaveLength(2);
});

test("idempotent: does nothing if day already has tasks", () => {
  const { db, c, t1, t2 } = setup();
  addToDailyPlan(db, c.id, t1.id);
  assignTask(db, { childId: c.id, templateId: t2.id, date: "2026-07-01" }); // pre-existing
  const result = ensureDailyTasks(db, c.id, "2026-07-01");
  expect(result).toHaveLength(1); // unchanged, not 1+1
  expect(listTasks(db, c.id, "2026-07-01")).toHaveLength(1);
});

test("skips archived templates; empty plan creates nothing", () => {
  const { db, c, t1, t2 } = setup();
  addToDailyPlan(db, c.id, t1.id);
  addToDailyPlan(db, c.id, t2.id);
  archiveTemplate(db, t2.id);
  expect(ensureDailyTasks(db, c.id, "2026-07-01")).toHaveLength(1); // only t1

  const c2 = createChild(db, { name: "小红", grade: 2 });
  expect(ensureDailyTasks(db, c2.id, "2026-07-01")).toHaveLength(0); // no plan
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/ensure-daily.test.ts`
Expected: FAIL（`ensureDailyTasks` 未定义）

- [ ] **Step 3: 实现（在 `lib/repositories/tasks.ts` 末尾追加）**

```ts
export function ensureDailyTasks(
  db: Database.Database,
  childId: number,
  date: string,
): TaskInstance[] {
  const existing = listTasks(db, childId, date);
  if (existing.length > 0) return existing;
  const rows = db
    .prepare(
      `SELECT dp.template_id AS tid FROM daily_plan dp
       JOIN task_templates t ON t.id = dp.template_id
       WHERE dp.child_id = ? AND t.archived = 0
       ORDER BY dp.id`,
    )
    .all(childId) as { tid: number }[];
  for (const r of rows) {
    assignTask(db, { childId, templateId: r.tid, date });
  }
  return listTasks(db, childId, date);
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/ensure-daily.test.ts`
Expected: PASS

- [ ] **Step 5: 全量测试 + 提交**

Run: `npm test` → 全绿。
```bash
git add lib/repositories/tasks.ts tests/ensure-daily.test.ts
git commit -m "feat: add ensureDailyTasks auto-dispatch"
```

---

### Task 4: API — 每日计划 + ensure-day

**Files:**
- Create: `app/api/children/[id]/daily-plan/route.ts`
- Create: `app/api/children/[id]/ensure-day/route.ts`
- Test: `tests/api-daily-plan.test.ts`

**Interfaces:**
- Consumes: `getDb`、`listDailyPlan`/`addToDailyPlan`/`removeFromDailyPlan`、`ensureDailyTasks`。
- Produces:
  - `GET /api/children/[id]/daily-plan` → `number[]`
  - `POST /api/children/[id]/daily-plan` body `{templateId}` → `{ok:true}`（加入）
  - `DELETE /api/children/[id]/daily-plan` body `{templateId}` → `{ok:true}`（移除）
  - `POST /api/children/[id]/ensure-day` body `{date}` → `TaskInstance[]`

- [ ] **Step 1: daily-plan route**

`app/api/children/[id]/daily-plan/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listDailyPlan, addToDailyPlan, removeFromDailyPlan } from "@/lib/repositories/dailyPlan";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(listDailyPlan(getDb(), Number(id)));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  addToDailyPlan(getDb(), Number(id), Number(body.templateId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  removeFromDailyPlan(getDb(), Number(id), Number(body.templateId));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: ensure-day route**

`app/api/children/[id]/ensure-day/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureDailyTasks } from "@/lib/repositories/tasks";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  return NextResponse.json(ensureDailyTasks(getDb(), Number(id), body.date));
}
```

- [ ] **Step 3: 集成测试**

`tests/api-daily-plan.test.ts`:
```ts
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
```

- [ ] **Step 4: 运行测试 + build**

Run: `npm test -- tests/api-daily-plan.test.ts`
Expected: PASS

Run: `npx next build`
Expected: 编译通过（新路由出现）。

Run: `npm test`
Expected: 全绿。

- [ ] **Step 5: 提交**

```bash
git add app/api/children tests/api-daily-plan.test.ts
git commit -m "feat: daily-plan and ensure-day API"
```

---

### Task 5: /manage 每日计划配置区

**Files:**
- Modify: `app/manage/page.tsx`
- 验证：`npx next build` + 截图

**Interfaces:**
- Consumes: `GET/POST/DELETE /api/children/[id]/daily-plan`；既有 `children`(active)、`templates`(active) 状态。
- Produces: 无。

- [ ] **Step 1: 加载各孩子的每日计划**

在 `app/manage/page.tsx` 组件内新增 plans 状态与加载（在既有 `reload()` 内补充）：
```tsx
const [plans, setPlans] = useState<Record<number, number[]>>({});
```
在 `reload()` 末尾追加（拉取每个**活跃**孩子的计划）：
```tsx
    fetch("/api/children?all=1").then((r) => r.json()).then((cs: ChildRow[]) => {
      cs.filter((c) => c.archived === 0).forEach((c) => {
        fetch(`/api/children/${c.id}/daily-plan`).then((r) => r.json()).then((ids: number[]) =>
          setPlans((p) => ({ ...p, [c.id]: ids })),
        );
      });
    });
```

- [ ] **Step 2: 切换计划项的处理函数**

在组件内新增：
```tsx
async function togglePlan(childId: number, templateId: number, on: boolean) {
  await fetch(`/api/children/${childId}/daily-plan`, {
    method: on ? "POST" : "DELETE",
    body: JSON.stringify({ templateId }),
  });
  setPlans((p) => {
    const cur = p[childId] ?? [];
    return { ...p, [childId]: on ? [...cur, templateId] : cur.filter((x) => x !== templateId) };
  });
}
```

- [ ] **Step 3: 渲染「每日计划」区**

在「已归档」section 之前插入新 section（用活跃孩子 × 活跃模板的勾选矩阵）：
```tsx
      <section>
        <h2 className="mb-2 font-semibold">每日计划（打开应用自动派发当天）</h2>
        {activeChildren.map((c) => (
          <div key={c.id} className="card mb-2">
            <div className="mb-1 font-medium">{c.avatar} {c.name}</div>
            <div className="flex flex-wrap gap-3">
              {activeTpls.map((t) => {
                const on = (plans[c.id] ?? []).includes(t.id);
                return (
                  <label key={t.id} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={on} onChange={(e) => togglePlan(c.id, t.id, e.target.checked)} />
                    {t.name}
                  </label>
                );
              })}
              {activeTpls.length === 0 && <span className="text-slate-500 text-sm">先在上面添加任务模板</span>}
            </div>
          </div>
        ))}
      </section>
```
（`activeChildren`、`activeTpls` 是该页已有的派生变量；若名称不同，按页面实际的"活跃孩子/活跃模板"派生变量替换。）

- [ ] **Step 4: build + 全量测试**

Run: `npx next build`
Expected: 编译通过。

Run: `npm test`
Expected: 全绿。

- [ ] **Step 5: 浏览器验证**

Run: `npm run dev`，打开 `/manage`
Expected: 「每日计划」区按孩子列出模板复选框；勾选/取消即时保存（刷新后保持）。

- [ ] **Step 6: 提交**

```bash
git add app/manage/page.tsx
git commit -m "feat: daily plan config section on manage page"
```

---

### Task 6: 今日页打开时自动派发

**Files:**
- Modify: `app/page.tsx`
- 验证：`npx next build` + 截图

**Interfaces:**
- Consumes: `POST /api/children/[id]/ensure-day`；既有 `childId`、`date`、`loadTasks`。
- Produces: 无。

- [ ] **Step 1: 在 loadTasks 前对 date≥今天调 ensure-day**

在 `app/page.tsx`，确保有本地今天字符串（页面已有 `today()` 助手）。把 `loadTasks` 改为先 ensure 再取（仅当 `date >= today()`）：
```tsx
  async function loadTasks() {
    if (!childId) return;
    if (date >= today()) {
      await fetch(`/api/children/${childId}/ensure-day`, {
        method: "POST",
        body: JSON.stringify({ date }),
      });
    }
    const t = await fetch(`/api/tasks?childId=${childId}&date=${date}`).then((r) => r.json());
    setTasks(t);
    const p = await fetch(`/api/children/${childId}/progress?date=${date}`).then((r) => r.json());
    setProgress(p);
  }
```
（保留 `loadTasks` 内既有的进度拉取那两行；只在最前面加 ensure-day 调用。`today()` 返回本地 `YYYY-MM-DD`，字符串比较对该格式按字典序即时间序，成立。）

- [ ] **Step 2: build + 全量测试**

Run: `npx next build`
Expected: 编译通过。

Run: `npm test`
Expected: 全绿。

- [ ] **Step 3: 浏览器验证**

Run: `npm run dev`；先在 /manage 给某孩子配几个每日计划项；到今日页选该孩子、日期为今天或未来某天（该天此前无任务）
Expected: 打开即自动出现计划中的任务（pending）；过去的空白日期不自动生成；当天已有任务时不重复生成。

- [ ] **Step 4: 提交**

```bash
git add app/page.tsx
git commit -m "feat: auto-dispatch daily tasks on opening today page"
```

---

## Self-Review

**Spec coverage（对照 2026-06-30-daily-plan-and-task-timestamps-design.md 块一）：**
- daily_plan 表（CREATE TABLE IF NOT EXISTS，既有库自动补建）→ Task 1 ✓
- 每日计划仓储 list/add/remove → Task 2 ✓
- ensureDailyTasks 幂等 / 跳过归档模板 / 空计划不建 / 仅当天零任务 → Task 3 ✓
- API：daily-plan GET/POST/DELETE + ensure-day → Task 4 ✓
- /manage 每日计划区（按孩子勾选活跃模板）→ Task 5 ✓
- 今日页打开时 date≥今天调 ensure-day → Task 6 ✓
- 手动派发保留（未改派发按钮）✓
- 任务时间戳（块二）→ Plan 2/2，不在此计划。

**Placeholder scan：** 无 TBD/TODO；每步含完整代码与命令。

**Type consistency：** `listDailyPlan`→`number[]`（Task 2）被 Task 3 SQL join 与 Task 4 GET、Task 5 UI 一致消费；`ensureDailyTasks(db,childId,date):TaskInstance[]`（Task 3）被 Task 4 ensure-day 与 Task 6 调用一致；API 路径 `/api/children/[id]/daily-plan`、`/ensure-day` 在 Task 4 定义与 Task 5/6 调用一致；`togglePlan` POST/DELETE 与 Task 4 方法一致。

**注：** `app/manage/page.tsx`、`app/page.tsx` 已多次演进，实现者须读实际文件，按"同语义位置/派生变量"集成（reload 末尾、loadTasks 内、活跃孩子/模板派生变量），不要凭记忆整体替换。
