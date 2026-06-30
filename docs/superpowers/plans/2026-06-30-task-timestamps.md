# 任务时间戳生命周期 实现计划 — Plan 2/2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 任务走 开始 → 完成 → 评分 三步并记录各自时间戳，记录页展示三个时间。

**Architecture:** `task_instances` 加 `started_at/completed_at/scored_at` 三列（幂等迁移）。状态枚举扩展为 pending→in_progress→done→scored。仓储加 `startTask`/`completeTask`，`scoreTask` 记 `scored_at`。今日页按状态显示进阶按钮；记录页展示时间戳。顺带给 `daily_plan` 加唯一索引（整支审查建议）。

**Tech Stack:** Next.js 15 App Router, TypeScript, better-sqlite3, Vitest, Tailwind v3。

## Global Constraints

- 不引入新依赖；better-sqlite3 同步 API；仓储函数首参 `db`；snake↔camel 显式映射。
- 新列经 `ALTER TABLE ADD COLUMN`（缺列才加，沿用 runMigrations 模式）；新库由 schema 直接含列。
- 状态流转：`pending` →(开始 started_at)→ `in_progress` →(完成 completed_at)→ `done` →(评分 scored_at + 得分)→ `scored`。
- `scored_at` 仅首次评分写入，重评保留原值（`scored_at = COALESCE(scored_at, ?)`）。
- `daily_plan` 唯一索引：`CREATE UNIQUE INDEX IF NOT EXISTS`（幂等，既有库适用）。
- TDD（仓储）；UI 以 `npx next build` 通过 + 截图验证；既有 36 项测试保持通过（注意状态枚举扩展、scoreTask 多写 scored_at 不应破坏既有断言）。

---

## File Structure

- `lib/schema.sql` — 修改：task_instances 加三列；daily_plan 唯一索引。
- `lib/db.ts` — 修改：runMigrations 加三列 ALTER。
- `lib/types.ts` — 修改：`TaskStatus` 加 `in_progress`；`TaskInstance` 加 `startedAt/completedAt/scoredAt`。
- `lib/repositories/tasks.ts` — 修改：`Row`/`toTask` 加三列映射；加 `startTask`/`completeTask`；`scoreTask` 记 scored_at。
- `app/api/tasks/[id]/start/route.ts`、`.../complete/route.ts` — 新建。
- `app/page.tsx` — 修改：状态进阶按钮（开始/完成/评分）。
- `app/records/page.tsx` — 修改：每项展示三时间戳。

---

### Task 1: 三列迁移 + 类型 + 映射 + daily_plan 唯一索引

**Files:**
- Modify: `lib/schema.sql`, `lib/db.ts`, `lib/types.ts`, `lib/repositories/tasks.ts`
- Test: `tests/task-timestamps-schema.test.ts`

**Interfaces:**
- Consumes: `createDb`、`runMigrations`、`hasColumn`（已有）；`assignTask`（已有）。
- Produces:
  - `task_instances` 含 `started_at`、`completed_at`、`scored_at`（TEXT，可空）。
  - `TaskStatus = 'pending' | 'in_progress' | 'done' | 'scored'`。
  - `TaskInstance` 加 `startedAt: string | null`、`completedAt: string | null`、`scoredAt: string | null`；`toTask` 映射之。
  - `daily_plan(child_id, template_id)` 唯一索引存在。

- [ ] **Step 1: schema 加列与索引**

在 `lib/schema.sql` 的 `task_instances` 建表语句中，在 `points_awarded INTEGER` 后追加三列（保持其余列不变）：
```sql
  points_awarded INTEGER,
  started_at TEXT,
  completed_at TEXT,
  scored_at TEXT
```
并在文件末尾（`daily_plan` 表之后）追加唯一索引：
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_plan_child_template
  ON daily_plan(child_id, template_id);
```

- [ ] **Step 2: 类型更新**

在 `lib/types.ts`：
- `TaskStatus` 改为：`export type TaskStatus = "pending" | "in_progress" | "done" | "scored";`
- `TaskInstance` 接口加三个字段：`startedAt: string | null;`、`completedAt: string | null;`、`scoredAt: string | null;`

- [ ] **Step 3: 迁移加三列**

将 `lib/db.ts` 的 `runMigrations` 整个函数替换为（保留既有两列，新增三列）：
```ts
export function runMigrations(db: Database.Database): void {
  if (!hasColumn(db, "children", "archived")) {
    db.exec("ALTER TABLE children ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  }
  if (!hasColumn(db, "task_templates", "archived")) {
    db.exec("ALTER TABLE task_templates ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  }
  if (!hasColumn(db, "task_instances", "started_at")) {
    db.exec("ALTER TABLE task_instances ADD COLUMN started_at TEXT");
  }
  if (!hasColumn(db, "task_instances", "completed_at")) {
    db.exec("ALTER TABLE task_instances ADD COLUMN completed_at TEXT");
  }
  if (!hasColumn(db, "task_instances", "scored_at")) {
    db.exec("ALTER TABLE task_instances ADD COLUMN scored_at TEXT");
  }
}
```

- [ ] **Step 4: Row + toTask 映射三列**

在 `lib/repositories/tasks.ts` 的 `Row` 接口加三字段，`toTask` 加三映射。`Row` 接口加：
```ts
  started_at: string | null;
  completed_at: string | null;
  scored_at: string | null;
```
`toTask` 返回对象加：
```ts
    startedAt: r.started_at,
    completedAt: r.completed_at,
    scoredAt: r.scored_at,
```

- [ ] **Step 5: 写失败测试**

`tests/task-timestamps-schema.test.ts`:
```ts
import { expect, test } from "vitest";
import Database from "better-sqlite3";
import { createDb, runMigrations } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask } from "@/lib/repositories/tasks";

test("new task has null timestamps via toTask", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const t = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  const task = assignTask(db, { childId: c.id, templateId: t.id, date: "2026-07-01" });
  expect(task.startedAt).toBeNull();
  expect(task.completedAt).toBeNull();
  expect(task.scoredAt).toBeNull();
});

test("migration adds the three columns to a legacy task_instances", () => {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE children (id INTEGER PRIMARY KEY)");
  db.exec("CREATE TABLE task_templates (id INTEGER PRIMARY KEY)");
  db.exec(
    "CREATE TABLE task_instances (id INTEGER PRIMARY KEY, child_id INTEGER, template_id INTEGER, date TEXT, status TEXT, actual_minutes INTEGER, focused INTEGER, used_scaffold INTEGER, did_check INTEGER, error_count INTEGER, note TEXT, points_awarded INTEGER)",
  );
  runMigrations(db);
  runMigrations(db); // idempotent
  const cols = (db.prepare("PRAGMA table_info(task_instances)").all() as { name: string }[]).map((c) => c.name);
  expect(cols).toContain("started_at");
  expect(cols).toContain("completed_at");
  expect(cols).toContain("scored_at");
});

test("daily_plan has a unique index on (child_id, template_id)", () => {
  const db = createDb(":memory:");
  const idx = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_daily_plan_child_template'")
    .get() as { name: string } | undefined;
  expect(idx?.name).toBe("idx_daily_plan_child_template");
});
```

- [ ] **Step 6: 运行测试，确认失败 → 通过**

Run: `npm test -- tests/task-timestamps-schema.test.ts`
Expected: 先 FAIL（字段/列/索引缺），完成 Step 1-4 后 PASS。

- [ ] **Step 7: 全量测试**

Run: `npm test`
Expected: 全绿（既有用例不受影响）。

- [ ] **Step 8: 提交**

```bash
git add lib/schema.sql lib/db.ts lib/types.ts lib/repositories/tasks.ts tests/task-timestamps-schema.test.ts
git commit -m "feat: add task timestamp columns + status states + daily_plan unique index"
```

---

### Task 2: startTask / completeTask

**Files:**
- Modify: `lib/repositories/tasks.ts`
- Test: `tests/task-lifecycle.test.ts`

**Interfaces:**
- Consumes: 既有 `assignTask`、内部 `getTask`/`toTask`；`TaskInstance`。
- Produces:
  - `startTask(db, taskId, now?): TaskInstance`（`UPDATE ... SET started_at=?, status='in_progress' WHERE id=?`）
  - `completeTask(db, taskId, now?): TaskInstance`（`UPDATE ... SET completed_at=?, status='done' WHERE id=?`）
  - `now` 默认 `new Date().toISOString()`，可注入便于测试。

- [ ] **Step 1: 写失败测试**

`tests/task-lifecycle.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask, startTask, completeTask } from "@/lib/repositories/tasks";

function setup() {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const tpl = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  const t = assignTask(db, { childId: c.id, templateId: tpl.id, date: "2026-07-01" });
  return { db, t };
}

test("startTask sets started_at and status in_progress", () => {
  const { db, t } = setup();
  const r = startTask(db, t.id, "2026-07-01T08:00:00.000Z");
  expect(r.status).toBe("in_progress");
  expect(r.startedAt).toBe("2026-07-01T08:00:00.000Z");
  expect(r.completedAt).toBeNull();
});

test("completeTask sets completed_at and status done", () => {
  const { db, t } = setup();
  startTask(db, t.id, "2026-07-01T08:00:00.000Z");
  const r = completeTask(db, t.id, "2026-07-01T08:10:00.000Z");
  expect(r.status).toBe("done");
  expect(r.completedAt).toBe("2026-07-01T08:10:00.000Z");
  expect(r.startedAt).toBe("2026-07-01T08:00:00.000Z");
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/task-lifecycle.test.ts`
Expected: FAIL（函数未定义）

- [ ] **Step 3: 实现（在 `lib/repositories/tasks.ts` 追加；`getTask` 已是模块内函数）**

```ts
export function startTask(
  db: Database.Database,
  taskId: number,
  now?: string,
): TaskInstance {
  const ts = now ?? new Date().toISOString();
  db.prepare(
    "UPDATE task_instances SET started_at = ?, status = 'in_progress' WHERE id = ?",
  ).run(ts, taskId);
  return getTask(db, taskId)!;
}

export function completeTask(
  db: Database.Database,
  taskId: number,
  now?: string,
): TaskInstance {
  const ts = now ?? new Date().toISOString();
  db.prepare(
    "UPDATE task_instances SET completed_at = ?, status = 'done' WHERE id = ?",
  ).run(ts, taskId);
  return getTask(db, taskId)!;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/task-lifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: 全量测试 + 提交**

Run: `npm test` → 全绿。
```bash
git add lib/repositories/tasks.ts tests/task-lifecycle.test.ts
git commit -m "feat: add startTask and completeTask"
```

---

### Task 3: scoreTask 记 scored_at

**Files:**
- Modify: `lib/repositories/tasks.ts`
- Test: `tests/tasks.test.ts`

**Interfaces:**
- Consumes: 既有 `scoreTask`（upsert）。
- Produces: `scoreTask` 在任务行 UPDATE 中加 `scored_at = COALESCE(scored_at, ?)`（传 now），首次评分写入、重评保留。

- [ ] **Step 1: 写失败测试（追加到 `tests/tasks.test.ts`）**

在 `tests/tasks.test.ts` 末尾追加（文件已有 `setup()`、`assignTask`、`scoreTask` 引入；如未引入 `startTask` 不需要）：
```ts
test("scoreTask records scored_at on first score and preserves it on re-score", () => {
  const { db, child, tpl } = setup();
  const t = assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-07-01" });
  const first = scoreTask(db, t.id, { actualMinutes: 5, focused: false, usedScaffold: false, didCheck: false, errorCount: 0, now: "2026-07-01T09:00:00.000Z" });
  expect(first.scoredAt).toBe("2026-07-01T09:00:00.000Z");
  const again = scoreTask(db, t.id, { actualMinutes: 6, focused: true, usedScaffold: false, didCheck: false, errorCount: 0, now: "2026-07-01T10:00:00.000Z" });
  expect(again.scoredAt).toBe("2026-07-01T09:00:00.000Z"); // preserved
  expect(again.pointsAwarded).toBe(15); // re-score still updates points
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/tasks.test.ts`
Expected: FAIL（`scoredAt` 为 null，未写入）

- [ ] **Step 3: 实现**

在 `lib/repositories/tasks.ts` 的 `scoreTask` 内，找到任务行 UPDATE 语句，把它改为同时写 `scored_at`（用 COALESCE 保留首次值）。把那条 UPDATE 改为：
```ts
    db.prepare(
      `UPDATE task_instances SET status='scored', actual_minutes=?, focused=?, used_scaffold=?, did_check=?, error_count=?, note=?, points_awarded=?, scored_at=COALESCE(scored_at, ?) WHERE id=?`,
    ).run(
      result.actualMinutes,
      result.focused ? 1 : 0,
      result.usedScaffold ? 1 : 0,
      result.didCheck ? 1 : 0,
      result.errorCount,
      result.note ?? null,
      points,
      result.now ?? new Date().toISOString(),
      taskId,
    );
```
（即在 `points_awarded=?` 后加 `, scored_at=COALESCE(scored_at, ?)`，并在 `points` 与 `taskId` 之间插入 `result.now ?? new Date().toISOString()` 参数。其余 upsert 逻辑——首评 addPointEntry / 重评 update 流水——保持不变。）

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/tasks.test.ts`
Expected: PASS（含既有评分/重评测试 + 新 scored_at 测试）。

- [ ] **Step 5: 全量测试 + 提交**

Run: `npm test` → 全绿。
```bash
git add lib/repositories/tasks.ts tests/tasks.test.ts
git commit -m "feat: record scored_at on scoreTask (preserved on re-score)"
```

---

### Task 4: API — start / complete

**Files:**
- Create: `app/api/tasks/[id]/start/route.ts`、`app/api/tasks/[id]/complete/route.ts`
- Test: `tests/api-lifecycle.test.ts`

**Interfaces:**
- Consumes: `getDb`、`startTask`、`completeTask`。
- Produces：`POST /api/tasks/[id]/start` → 任务；`POST /api/tasks/[id]/complete` → 任务。

- [ ] **Step 1: start route**

`app/api/tasks/[id]/start/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { startTask } from "@/lib/repositories/tasks";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(startTask(getDb(), Number(id)));
}
```

- [ ] **Step 2: complete route**

`app/api/tasks/[id]/complete/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { completeTask } from "@/lib/repositories/tasks";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(completeTask(getDb(), Number(id)));
}
```

- [ ] **Step 3: 集成测试**

`tests/api-lifecycle.test.ts`:
```ts
import { expect, test } from "vitest";

process.env.DB_PATH = ":memory:";

test("start then complete transitions status", async () => {
  const { POST: createChild } = await import("@/app/api/children/route");
  const child = await (await createChild(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "小明", grade: 1 }) }))).json();
  const { POST: createTpl } = await import("@/app/api/templates/route");
  const tpl = await (await createTpl(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 }) }))).json();
  const { POST: assign } = await import("@/app/api/tasks/route");
  const task = await (await assign(new Request("http://x", { method: "POST", body: JSON.stringify({ childId: child.id, templateId: tpl.id, date: "2026-07-01" }) }))).json();

  const params = { params: Promise.resolve({ id: String(task.id) }) };
  const { POST: start } = await import("@/app/api/tasks/[id]/start/route");
  const started = await (await start(new Request("http://x", { method: "POST" }), params)).json();
  expect(started.status).toBe("in_progress");
  expect(started.startedAt).not.toBeNull();

  const { POST: complete } = await import("@/app/api/tasks/[id]/complete/route");
  const done = await (await complete(new Request("http://x", { method: "POST" }), params)).json();
  expect(done.status).toBe("done");
  expect(done.completedAt).not.toBeNull();
});
```

- [ ] **Step 4: 运行测试 + build**

Run: `npm test -- tests/api-lifecycle.test.ts` → PASS
Run: `npx next build` → 编译通过（新路由出现）。
Run: `npm test` → 全绿。

- [ ] **Step 5: 提交**

```bash
git add app/api/tasks tests/api-lifecycle.test.ts
git commit -m "feat: start and complete task API"
```

---

### Task 5: 今日页生命周期按钮

**Files:**
- Modify: `app/page.tsx`
- 验证：`npx next build` + 截图

**Interfaces:**
- Consumes: `POST /api/tasks/[id]/start`、`/complete`；既有 `loadTasks`、`scoring` 状态、`ScoreForm`、`initialFor`。
- Produces: 无。

- [ ] **Step 1: 加 start/complete 处理函数**

在 `app/page.tsx` 组件内（`assign` 附近）新增：
```tsx
  async function startTaskAction(id: number) {
    await fetch(`/api/tasks/${id}/start`, { method: "POST" });
    loadTasks();
  }
  async function completeTaskAction(id: number) {
    await fetch(`/api/tasks/${id}/complete`, { method: "POST" });
    loadTasks();
  }
```

- [ ] **Step 2: 按状态显示进阶按钮**

在今日任务列表项中，把现有"已评分→chip+查看/修改 / 否则→评分按钮"的那段（右侧操作区）替换为按四状态分支：
```tsx
{t.status === "pending" && (
  <button onClick={() => startTaskAction(t.id)} className="btn btn-sky px-3 py-1 text-sm">开始</button>
)}
{t.status === "in_progress" && (
  <button onClick={() => completeTaskAction(t.id)} className="btn btn-emerald px-3 py-1 text-sm">完成</button>
)}
{t.status === "done" && (
  <button onClick={() => setScoring(scoring === t.id ? null : t.id)} className="btn btn-primary px-3 py-1 text-sm">评分</button>
)}
{t.status === "scored" && (
  <span className="flex items-center gap-2">
    <span className="chip bg-emerald-100 text-emerald-700">🎉 已评分 +{t.pointsAwarded}</span>
    <button onClick={() => setScoring(scoring === t.id ? null : t.id)} className="btn btn-sky px-3 py-1 text-sm">查看/修改</button>
  </span>
)}
```
ScoreForm 渲染那行保持上一轮的写法（done 时无 initial，scored 时传 `initialFor(t)`）：
```tsx
{scoring === t.id && (
  <ScoreForm
    taskId={t.id}
    initial={t.status === "scored" ? initialFor(t) : undefined}
    onDone={() => { setScoring(null); loadTasks(); }}
  />
)}
```

- [ ] **Step 3: build + 全量测试**

Run: `npx next build` → 编译通过。
Run: `npm test` → 全绿。

- [ ] **Step 4: 浏览器验证**

Run: `npm run dev`，打开 `/`，对一个 pending 任务依次点 开始 → 完成 → 评分
Expected: 按钮随状态推进（开始→完成→评分→已评分+查看/修改）；评分保存后显示得分。

- [ ] **Step 5: 提交**

```bash
git add app/page.tsx
git commit -m "feat: task lifecycle buttons (start/complete/score) on today page"
```

---

### Task 6: 记录页展示时间戳

**Files:**
- Modify: `app/records/page.tsx`
- 验证：`npx next build` + 截图

**Interfaces:**
- Consumes: `GET /api/tasks?childId=&date=`（任务对象现含 `startedAt/completedAt/scoredAt`）；既有 `fmt`。
- Produces: 无。

- [ ] **Step 1: 扩展 records 的 Task 接口**

在 `app/records/page.tsx` 的本地 `Task` 接口加三字段：
```tsx
interface Task {
  id: number;
  templateId: number;
  status: string;
  pointsAwarded: number | null;
  startedAt: string | null;
  completedAt: string | null;
  scoredAt: string | null;
}
```

- [ ] **Step 2: 在按天回看每项下展示三时间**

把「按天回看任务」列表项改为在原有行下补一行时间戳（用既有 `fmt`，未发生显示 —）：
```tsx
          {tasks.map((t) => (
            <li key={t.id} className="card">
              <div className="flex items-center justify-between">
                <span>{tplName(t.templateId)}</span>
                {t.status === "scored"
                  ? <span className="chip bg-emerald-100 text-emerald-700">已评分 +{t.pointsAwarded}</span>
                  : <span className="chip bg-slate-100 text-slate-500">{t.status === "done" ? "待评分" : t.status === "in_progress" ? "进行中" : "未开始"}</span>}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                开始 {t.startedAt ? fmt(t.startedAt) : "—"} · 完成 {t.completedAt ? fmt(t.completedAt) : "—"} · 评分 {t.scoredAt ? fmt(t.scoredAt) : "—"}
              </div>
            </li>
          ))}
```
（保留外层 `<ul>` 与空状态 `这一天没有任务。` 不变。）

- [ ] **Step 3: build + 全量测试**

Run: `npx next build` → 编译通过。
Run: `npm test` → 全绿。

- [ ] **Step 4: 浏览器验证**

Run: `npm run dev`，打开 `/records`，选有任务的日期
Expected: 每项任务下显示 开始/完成/评分 三个时间（未发生为 —），状态 chip 反映 未开始/进行中/待评分/已评分。

- [ ] **Step 5: 提交**

```bash
git add app/records/page.tsx
git commit -m "feat: show task timestamps in records"
```

---

## Self-Review

**Spec coverage（对照 2026-06-30-daily-plan-and-task-timestamps-design.md 块二）：**
- task_instances 三列 + 迁移 → Task 1 ✓
- 状态枚举扩展 in_progress → Task 1（types）+ Task 2/5（使用）✓
- TaskInstance 三字段 + toTask 映射 → Task 1 ✓
- startTask/completeTask → Task 2 ✓
- scoreTask 记 scored_at（COALESCE 保留）→ Task 3 ✓
- start/complete API → Task 4 ✓
- 今日页 开始/完成/评分 进阶按钮 → Task 5 ✓
- 记录页三时间戳展示 → Task 6 ✓
- daily_plan 唯一索引（整支审查建议）→ Task 1 ✓
- 每日计划/自动派发 → Plan 1/2（已完成）。

**Placeholder scan：** 无 TBD/TODO；每步含完整代码与命令。

**Type consistency：** `TaskStatus` 四值（Task 1）被 Task 5 分支与 Task 6 状态 chip 一致使用；`startedAt/completedAt/scoredAt`（Task 1 类型 + toTask 映射）被 Task 2 测试、Task 4 API、Task 6 records 一致消费；`startTask/completeTask(db,id,now?)`（Task 2）被 Task 4 API、Task 5 page 调用一致；`scoreTask` 签名不变（Task 3 仅在 SQL 内加列），今日页调用不变。

**注：** `app/page.tsx`、`app/records/page.tsx`、`lib/repositories/tasks.ts` 已多次演进，实现者须读实际文件、按"同语义位置"修改（scoreTask 的任务行 UPDATE、今日页右侧操作区三元、records 列表项、Row/toTask），不要凭记忆整体替换未指明部分。
