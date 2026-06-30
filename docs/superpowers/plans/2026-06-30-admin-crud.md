# 管理端 CRUD（含归档/恢复）实现计划 — Plan 1/2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让管理页对孩子/任务模板/奖励支持编辑与归档/恢复（软删除），活跃列表自动排除已归档项。

**Architecture:** 数据层给 `children`、`task_templates` 加 `archived` 列（`rewards` 复用 `active`），并在 `db.ts` 加幂等 `ALTER TABLE` 迁移兼容旧库。仓储层新增 `update*`/`archive*`/`restore*` 与 `listAll*`，`list*` 改为排除归档。API 补 PATCH/archive/restore。`/manage` 页加行内编辑、归档/恢复按钮与「已归档」区。

**Tech Stack:** Next.js 15 App Router, TypeScript, better-sqlite3, Vitest, Tailwind v3。

## Global Constraints

- 软删除/归档：`children`、`task_templates` 用新列 `archived INTEGER NOT NULL DEFAULT 0`；`rewards` 用已有 `active`（`active=0`=归档）。
- 归档项从活跃列表隐藏；历史数据（任务实例、积分流水）不受影响。
- 不引入新依赖；better-sqlite3 同步 API；仓储函数首参 `db`；snake_case 列 ↔ camelCase 字段显式映射。
- 旧库兼容：`db.ts` 用幂等迁移（缺列才 `ALTER TABLE ADD COLUMN`）；新库由 schema 直接含列。
- 既有 16 项测试须保持通过；UI 改动以 `npx next build` 通过 + 截图验证。
- 可编辑字段：孩子 `name/grade/avatar`；模板 `name/subject/defaultMinutes/basePoints`；奖励 `name/cost`。
- `getChild`/`getTemplate` 仍按 id 取（不过滤归档），以保证对已派发任务/恢复操作可用。

---

## File Structure

- `lib/schema.sql` — 修改：children/task_templates 加 `archived` 列。
- `lib/db.ts` — 修改：加 `runMigrations`/`hasColumn`，createDb 内调用；导出 `runMigrations` 供测试。
- `lib/types.ts` — 修改：`Child`、`TaskTemplate` 加 `archived: number`。
- `lib/repositories/children.ts` — 修改：`listChildren` 排除归档；加 `getChild`(已存在保持)、`updateChild`、`archiveChild`、`restoreChild`、`listAllChildren`。
- `lib/repositories/templates.ts` — 修改：`listTemplates` 排除归档；加 `updateTemplate`、`archiveTemplate`、`restoreTemplate`、`listAllTemplates`。
- `lib/repositories/rewards.ts` — 修改：加 `updateReward`、`archiveReward`、`restoreReward`、`listAllRewards`。
- `app/api/children/route.ts` / `app/api/children/[id]/route.ts` / `app/api/children/[id]/archive/route.ts` / `.../restore/route.ts` — 增改。
- 同样为 templates、rewards 增改对应 API。
- `app/manage/page.tsx` — 修改：行内编辑、归档/恢复、已归档区。

---

### Task 1: archived 列 + 迁移

**Files:**
- Modify: `lib/schema.sql`
- Modify: `lib/db.ts`
- Modify: `lib/types.ts`
- Test: `tests/migration.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `runMigrations(db: Database.Database): void`（导出，幂等：缺列才 ALTER）。
  - `Child`、`TaskTemplate` 类型新增 `archived: number`。
  - 新库与迁移后旧库的 `children`、`task_templates` 均含 `archived`（默认 0）。

- [ ] **Step 1: schema 加列**

在 `lib/schema.sql` 的 `children` 与 `task_templates` 建表语句中各加一列。children 改为：
```sql
CREATE TABLE IF NOT EXISTS children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  grade INTEGER NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🐣',
  archived INTEGER NOT NULL DEFAULT 0
);
```
task_templates 改为：
```sql
CREATE TABLE IF NOT EXISTS task_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  default_minutes INTEGER NOT NULL,
  base_points INTEGER NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);
```

- [ ] **Step 2: 类型加字段**

在 `lib/types.ts`：`Child` 接口加 `archived: number;`；`TaskTemplate` 接口加 `archived: number;`。

- [ ] **Step 3: 写失败测试**

`tests/migration.test.ts`:
```ts
import { expect, test } from "vitest";
import Database from "better-sqlite3";
import { createDb, runMigrations } from "@/lib/db";

test("fresh db: children & task_templates have archived defaulting 0", () => {
  const db = createDb(":memory:");
  const c = db.prepare("INSERT INTO children (name, grade) VALUES ('小明', 1)").run();
  const row = db.prepare("SELECT archived FROM children WHERE id = ?").get(c.lastInsertRowid) as { archived: number };
  expect(row.archived).toBe(0);
});

test("runMigrations adds archived to legacy tables lacking it (idempotent)", () => {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE children (id INTEGER PRIMARY KEY, name TEXT, grade INTEGER)");
  db.exec("CREATE TABLE task_templates (id INTEGER PRIMARY KEY, name TEXT, subject TEXT, default_minutes INTEGER, base_points INTEGER)");
  runMigrations(db);
  runMigrations(db); // second call must not throw
  const cols = db.prepare("PRAGMA table_info(children)").all() as { name: string }[];
  const tcols = db.prepare("PRAGMA table_info(task_templates)").all() as { name: string }[];
  expect(cols.some((c) => c.name === "archived")).toBe(true);
  expect(tcols.some((c) => c.name === "archived")).toBe(true);
});
```

- [ ] **Step 4: 运行测试，确认失败**

Run: `npm test -- tests/migration.test.ts`
Expected: FAIL（`runMigrations` 未导出 / 不存在）

- [ ] **Step 5: 实现迁移**

将 `lib/db.ts` 整体替换为：
```ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function hasColumn(
  db: Database.Database,
  table: string,
  column: string,
): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return cols.some((c) => c.name === column);
}

export function runMigrations(db: Database.Database): void {
  if (!hasColumn(db, "children", "archived")) {
    db.exec("ALTER TABLE children ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  }
  if (!hasColumn(db, "task_templates", "archived")) {
    db.exec("ALTER TABLE task_templates ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  }
}

export function createDb(filename: string): Database.Database {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "schema.sql"),
    "utf8",
  );
  db.exec(schema);
  runMigrations(db);
  return db;
}

let _db: Database.Database | null = null;
export function getDb(): Database.Database {
  if (!_db) _db = createDb(process.env.DB_PATH ?? "data/app.db");
  return _db;
}
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `npm test -- tests/migration.test.ts`
Expected: PASS

- [ ] **Step 7: 全量测试**

Run: `npm test`
Expected: 既有用例 + 新用例全部通过（注意：此时 `listChildren`/`listTemplates` 尚未改过滤，旧测试仍应通过；新列默认 0 不影响）。

- [ ] **Step 8: 提交**

```bash
git add lib/schema.sql lib/db.ts lib/types.ts tests/migration.test.ts
git commit -m "feat: add archived column + idempotent migration"
```

---

### Task 2: 孩子仓储 update/archive/restore + 列表过滤

**Files:**
- Modify: `lib/repositories/children.ts`
- Test: `tests/children-crud.test.ts`

**Interfaces:**
- Consumes: `createDb`、`Child`（含 `archived`）。
- Produces:
  - `updateChild(db, id, input: { name: string; grade: number; avatar: string }): Child`
  - `archiveChild(db, id): void`（置 archived=1）
  - `restoreChild(db, id): void`（置 archived=0）
  - `listChildren(db): Child[]`（仅 archived=0，ORDER BY id）
  - `listAllChildren(db): Child[]`（含归档，ORDER BY archived, id）
  - `getChild` 不变（按 id 取，不过滤）。

- [ ] **Step 1: 写失败测试**

`tests/children-crud.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import {
  createChild, listChildren, listAllChildren, getChild,
  updateChild, archiveChild, restoreChild,
} from "@/lib/repositories/children";

test("update changes fields", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const u = updateChild(db, c.id, { name: "小明明", grade: 2, avatar: "🐼" });
  expect(u.name).toBe("小明明");
  expect(u.grade).toBe(2);
  expect(u.avatar).toBe("🐼");
});

test("archive hides from listChildren but keeps in listAllChildren; restore brings back", () => {
  const db = createDb(":memory:");
  const a = createChild(db, { name: "老大", grade: 2 });
  const b = createChild(db, { name: "老二", grade: 1 });
  archiveChild(db, b.id);
  expect(listChildren(db).map((c) => c.id)).toEqual([a.id]);
  expect(listAllChildren(db)).toHaveLength(2);
  expect(getChild(db, b.id)?.archived).toBe(1);
  restoreChild(db, b.id);
  expect(listChildren(db).map((c) => c.id)).toEqual([a.id, b.id]);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/children-crud.test.ts`
Expected: FAIL（函数未定义）

- [ ] **Step 3: 实现**

将 `lib/repositories/children.ts` 整体替换为：
```ts
import type Database from "better-sqlite3";
import type { Child } from "@/lib/types";

export function createChild(
  db: Database.Database,
  input: { name: string; grade: number; avatar?: string },
): Child {
  const info = db
    .prepare("INSERT INTO children (name, grade, avatar) VALUES (?, ?, ?)")
    .run(input.name, input.grade, input.avatar ?? "🐣");
  return getChild(db, Number(info.lastInsertRowid))!;
}

export function updateChild(
  db: Database.Database,
  id: number,
  input: { name: string; grade: number; avatar: string },
): Child {
  db.prepare("UPDATE children SET name = ?, grade = ?, avatar = ? WHERE id = ?")
    .run(input.name, input.grade, input.avatar, id);
  return getChild(db, id)!;
}

export function archiveChild(db: Database.Database, id: number): void {
  db.prepare("UPDATE children SET archived = 1 WHERE id = ?").run(id);
}

export function restoreChild(db: Database.Database, id: number): void {
  db.prepare("UPDATE children SET archived = 0 WHERE id = ?").run(id);
}

export function listChildren(db: Database.Database): Child[] {
  return db
    .prepare("SELECT * FROM children WHERE archived = 0 ORDER BY id")
    .all() as Child[];
}

export function listAllChildren(db: Database.Database): Child[] {
  return db
    .prepare("SELECT * FROM children ORDER BY archived, id")
    .all() as Child[];
}

export function getChild(db: Database.Database, id: number): Child | undefined {
  return db.prepare("SELECT * FROM children WHERE id = ?").get(id) as
    | Child
    | undefined;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/children-crud.test.ts`
Expected: PASS

- [ ] **Step 5: 全量测试**

Run: `npm test`
Expected: 全绿（既有 children 测试仍通过——`listChildren` 默认数据均未归档）。

- [ ] **Step 6: 提交**

```bash
git add lib/repositories/children.ts tests/children-crud.test.ts
git commit -m "feat: children update/archive/restore + active-list filter"
```

---

### Task 3: 模板仓储 update/archive/restore + 列表过滤

**Files:**
- Modify: `lib/repositories/templates.ts`
- Test: `tests/templates-crud.test.ts`

**Interfaces:**
- Consumes: `createDb`、`TaskTemplate`（含 `archived`）、`Subject`。
- Produces:
  - `updateTemplate(db, id, input: { name: string; subject: Subject; defaultMinutes: number; basePoints: number }): TaskTemplate`
  - `archiveTemplate(db, id): void`、`restoreTemplate(db, id): void`
  - `listTemplates(db): TaskTemplate[]`（仅未归档）
  - `listAllTemplates(db): TaskTemplate[]`（含归档）
  - `getTemplate` 不变（按 id 取，不过滤；scoreTask 依赖）。

- [ ] **Step 1: 写失败测试**

`tests/templates-crud.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import {
  createTemplate, listTemplates, listAllTemplates, getTemplate,
  updateTemplate, archiveTemplate, restoreTemplate,
} from "@/lib/repositories/templates";

const base = { name: "写字", subject: "writing" as const, defaultMinutes: 5, basePoints: 10 };

test("update changes fields incl. subject and basePoints", () => {
  const db = createDb(":memory:");
  const t = createTemplate(db, base);
  const u = updateTemplate(db, t.id, { name: "口算", subject: "math", defaultMinutes: 8, basePoints: 12 });
  expect(u.name).toBe("口算");
  expect(u.subject).toBe("math");
  expect(u.basePoints).toBe(12);
});

test("archive hides from listTemplates, kept in listAllTemplates; getTemplate still finds it", () => {
  const db = createDb(":memory:");
  const t = createTemplate(db, base);
  archiveTemplate(db, t.id);
  expect(listTemplates(db)).toHaveLength(0);
  expect(listAllTemplates(db)).toHaveLength(1);
  expect(getTemplate(db, t.id)?.archived).toBe(1);
  restoreTemplate(db, t.id);
  expect(listTemplates(db)).toHaveLength(1);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/templates-crud.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

将 `lib/repositories/templates.ts` 整体替换为：
```ts
import type Database from "better-sqlite3";
import type { Subject, TaskTemplate } from "@/lib/types";

interface Row {
  id: number;
  name: string;
  subject: Subject;
  default_minutes: number;
  base_points: number;
  archived: number;
}

function toTemplate(r: Row): TaskTemplate {
  return {
    id: r.id,
    name: r.name,
    subject: r.subject,
    defaultMinutes: r.default_minutes,
    basePoints: r.base_points,
    archived: r.archived,
  };
}

export function createTemplate(
  db: Database.Database,
  input: { name: string; subject: Subject; defaultMinutes: number; basePoints: number },
): TaskTemplate {
  const info = db
    .prepare(
      "INSERT INTO task_templates (name, subject, default_minutes, base_points) VALUES (?, ?, ?, ?)",
    )
    .run(input.name, input.subject, input.defaultMinutes, input.basePoints);
  return getTemplate(db, Number(info.lastInsertRowid))!;
}

export function updateTemplate(
  db: Database.Database,
  id: number,
  input: { name: string; subject: Subject; defaultMinutes: number; basePoints: number },
): TaskTemplate {
  db.prepare(
    "UPDATE task_templates SET name = ?, subject = ?, default_minutes = ?, base_points = ? WHERE id = ?",
  ).run(input.name, input.subject, input.defaultMinutes, input.basePoints, id);
  return getTemplate(db, id)!;
}

export function archiveTemplate(db: Database.Database, id: number): void {
  db.prepare("UPDATE task_templates SET archived = 1 WHERE id = ?").run(id);
}

export function restoreTemplate(db: Database.Database, id: number): void {
  db.prepare("UPDATE task_templates SET archived = 0 WHERE id = ?").run(id);
}

export function listTemplates(db: Database.Database): TaskTemplate[] {
  const rows = db
    .prepare("SELECT * FROM task_templates WHERE archived = 0 ORDER BY id")
    .all() as Row[];
  return rows.map(toTemplate);
}

export function listAllTemplates(db: Database.Database): TaskTemplate[] {
  const rows = db
    .prepare("SELECT * FROM task_templates ORDER BY archived, id")
    .all() as Row[];
  return rows.map(toTemplate);
}

export function getTemplate(
  db: Database.Database,
  id: number,
): TaskTemplate | undefined {
  const r = db.prepare("SELECT * FROM task_templates WHERE id = ?").get(id) as
    | Row
    | undefined;
  return r ? toTemplate(r) : undefined;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/templates-crud.test.ts`
Expected: PASS

- [ ] **Step 5: 全量测试**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 6: 提交**

```bash
git add lib/repositories/templates.ts tests/templates-crud.test.ts
git commit -m "feat: template update/archive/restore + active-list filter"
```

---

### Task 4: 奖励仓储 update/archive/restore

**Files:**
- Modify: `lib/repositories/rewards.ts`
- Test: `tests/rewards-crud.test.ts`

**Interfaces:**
- Consumes: `createDb`、`Reward`（含 `active`）、`addPointEntry`/`getBalance`（现有）。
- Produces:
  - `updateReward(db, id, input: { name: string; cost: number }): Reward`
  - `archiveReward(db, id): void`（active=0）、`restoreReward(db, id): void`（active=1）
  - `listAllRewards(db): Reward[]`（含归档，ORDER BY active DESC, cost）
  - `listRewards`（现状：仅 active=1）、`createReward`、`redeemReward` 不变。

- [ ] **Step 1: 写失败测试**

`tests/rewards-crud.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import {
  createReward, listRewards, listAllRewards,
  updateReward, archiveReward, restoreReward,
} from "@/lib/repositories/rewards";

test("update changes name and cost", () => {
  const db = createDb(":memory:");
  const r = createReward(db, { name: "看动画", cost: 30 });
  const u = updateReward(db, r.id, { name: "看动画40分钟", cost: 40 });
  expect(u.name).toBe("看动画40分钟");
  expect(u.cost).toBe(40);
});

test("archive removes from listRewards, kept in listAllRewards; restore brings back", () => {
  const db = createDb(":memory:");
  const r = createReward(db, { name: "出游", cost: 80 });
  archiveReward(db, r.id);
  expect(listRewards(db)).toHaveLength(0);
  expect(listAllRewards(db)).toHaveLength(1);
  expect(listAllRewards(db)[0].active).toBe(0);
  restoreReward(db, r.id);
  expect(listRewards(db)).toHaveLength(1);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/rewards-crud.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现（在 `lib/repositories/rewards.ts` 现有内容基础上追加/调整）**

在文件中新增以下导出函数（保持现有 `createReward`/`listRewards`/`redeemReward` 不变）：
```ts
export function updateReward(
  db: Database.Database,
  id: number,
  input: { name: string; cost: number },
): Reward {
  db.prepare("UPDATE rewards SET name = ?, cost = ? WHERE id = ?")
    .run(input.name, input.cost, id);
  return db.prepare("SELECT * FROM rewards WHERE id = ?").get(id) as Reward;
}

export function archiveReward(db: Database.Database, id: number): void {
  db.prepare("UPDATE rewards SET active = 0 WHERE id = ?").run(id);
}

export function restoreReward(db: Database.Database, id: number): void {
  db.prepare("UPDATE rewards SET active = 1 WHERE id = ?").run(id);
}

export function listAllRewards(db: Database.Database): Reward[] {
  return db
    .prepare("SELECT * FROM rewards ORDER BY active DESC, cost")
    .all() as Reward[];
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/rewards-crud.test.ts`
Expected: PASS

- [ ] **Step 5: 全量测试**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 6: 提交**

```bash
git add lib/repositories/rewards.ts tests/rewards-crud.test.ts
git commit -m "feat: reward update/archive/restore + listAllRewards"
```

---

### Task 5: API — 编辑 / 归档 / 恢复 / 含归档列表

**Files:**
- Modify: `app/api/children/route.ts`、`app/api/templates/route.ts`、`app/api/rewards/route.ts`（GET 支持 `?all=1`）
- Create: `app/api/children/[id]/route.ts`、`app/api/children/[id]/archive/route.ts`、`app/api/children/[id]/restore/route.ts`
- Create: 同结构的 `app/api/templates/[id]/...` 与 `app/api/rewards/[id]/...`
- Test: `tests/api-crud.test.ts`

**Interfaces:**
- Consumes: 各仓储 `update*`/`archive*`/`restore*`/`listAll*` + `getDb`。
- Produces：
  - `GET /api/children?all=1` → `listAllChildren`；否则 `listChildren`。同理 templates、rewards。
  - `PATCH /api/children/[id]` body `{name,grade,avatar}` → `updateChild`。templates/rewards 同理。
  - `POST /api/children/[id]/archive` / `.../restore`。templates/rewards 同理。

- [ ] **Step 1: GET 支持 ?all=1（三个 route）**

`app/api/children/route.ts`（替换 GET，POST 不变）：
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createChild, listChildren, listAllChildren } from "@/lib/repositories/children";

export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const db = getDb();
  return NextResponse.json(all ? listAllChildren(db) : listChildren(db));
}

export async function POST(req: Request) {
  const body = await req.json();
  const child = createChild(getDb(), {
    name: body.name,
    grade: Number(body.grade),
    avatar: body.avatar,
  });
  return NextResponse.json(child);
}
```

`app/api/templates/route.ts`（替换 GET）：
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createTemplate, listTemplates, listAllTemplates } from "@/lib/repositories/templates";

export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const db = getDb();
  return NextResponse.json(all ? listAllTemplates(db) : listTemplates(db));
}

export async function POST(req: Request) {
  const body = await req.json();
  const tpl = createTemplate(getDb(), {
    name: body.name,
    subject: body.subject,
    defaultMinutes: Number(body.defaultMinutes),
    basePoints: Number(body.basePoints),
  });
  return NextResponse.json(tpl);
}
```

`app/api/rewards/route.ts`（替换 GET）：
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createReward, listRewards, listAllRewards } from "@/lib/repositories/rewards";

export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const db = getDb();
  return NextResponse.json(all ? listAllRewards(db) : listRewards(db));
}

export async function POST(req: Request) {
  const body = await req.json();
  const reward = createReward(getDb(), { name: body.name, cost: Number(body.cost) });
  return NextResponse.json(reward);
}
```

- [ ] **Step 2: 孩子 PATCH / archive / restore**

`app/api/children/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { updateChild } from "@/lib/repositories/children";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const child = updateChild(getDb(), Number(id), {
    name: body.name,
    grade: Number(body.grade),
    avatar: body.avatar,
  });
  return NextResponse.json(child);
}
```

`app/api/children/[id]/archive/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { archiveChild } from "@/lib/repositories/children";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  archiveChild(getDb(), Number(id));
  return NextResponse.json({ ok: true });
}
```

`app/api/children/[id]/restore/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { restoreChild } from "@/lib/repositories/children";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  restoreChild(getDb(), Number(id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: 模板 PATCH / archive / restore**

`app/api/templates/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { updateTemplate } from "@/lib/repositories/templates";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const tpl = updateTemplate(getDb(), Number(id), {
    name: body.name,
    subject: body.subject,
    defaultMinutes: Number(body.defaultMinutes),
    basePoints: Number(body.basePoints),
  });
  return NextResponse.json(tpl);
}
```

`app/api/templates/[id]/archive/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { archiveTemplate } from "@/lib/repositories/templates";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  archiveTemplate(getDb(), Number(id));
  return NextResponse.json({ ok: true });
}
```

`app/api/templates/[id]/restore/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { restoreTemplate } from "@/lib/repositories/templates";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  restoreTemplate(getDb(), Number(id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: 奖励 PATCH / archive / restore**

`app/api/rewards/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { updateReward } from "@/lib/repositories/rewards";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const reward = updateReward(getDb(), Number(id), {
    name: body.name,
    cost: Number(body.cost),
  });
  return NextResponse.json(reward);
}
```

`app/api/rewards/[id]/archive/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { archiveReward } from "@/lib/repositories/rewards";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  archiveReward(getDb(), Number(id));
  return NextResponse.json({ ok: true });
}
```

`app/api/rewards/[id]/restore/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { restoreReward } from "@/lib/repositories/rewards";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  restoreReward(getDb(), Number(id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: 集成测试（直接调 handler）**

`tests/api-crud.test.ts`:
```ts
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
```

- [ ] **Step 6: 运行测试**

Run: `npm test -- tests/api-crud.test.ts`
Expected: PASS

- [ ] **Step 7: build + 全量测试**

Run: `npx next build`
Expected: 编译通过（新路由出现在路由表）。

Run: `npm test`
Expected: 全绿。

- [ ] **Step 8: 提交**

```bash
git add app/api tests/api-crud.test.ts
git commit -m "feat: CRUD/archive/restore API routes + all-list query"
```

---

### Task 6: 管理页 UI — 编辑 / 归档 / 恢复 / 已归档区

**Files:**
- Modify: `app/manage/page.tsx`
- 验证：`npx next build` + 浏览器截图

**Interfaces:**
- Consumes: `/api/children`（`?all=1`）、`/api/children/[id]`（PATCH）、`/api/children/[id]/archive|restore`；templates、rewards 同结构。
- Produces: 无。

- [ ] **Step 1: 重写管理页**

将 `app/manage/page.tsx` 整体替换为（保留童趣主题类；新增编辑态、归档/恢复、已归档区；用 `?all=1` 拉全量并在前端按 `archived/active` 分组）：
```tsx
"use client";
import { useEffect, useState } from "react";
import { SUBJECT_META } from "../_components/subjectMeta";

const SUBJECTS = [
  { value: "writing", label: "写字" },
  { value: "picture_composition", label: "看图写话" },
  { value: "math", label: "数学" },
  { value: "other", label: "其他" },
];

interface ChildRow { id: number; name: string; grade: number; avatar: string; archived: number }
interface TplRow { id: number; name: string; subject: string; defaultMinutes: number; basePoints: number; archived: number }
interface RewardRow { id: number; name: string; cost: number; active: number }

export default function Manage() {
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [templates, setTemplates] = useState<TplRow[]>([]);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  // create inputs
  const [cName, setCName] = useState(""); const [cGrade, setCGrade] = useState(1);
  const [tName, setTName] = useState(""); const [tSubject, setTSubject] = useState("writing");
  const [tMinutes, setTMinutes] = useState(5); const [tPoints, setTPoints] = useState(10);
  const [rName, setRName] = useState(""); const [rCost, setRCost] = useState(30);
  // edit state: which row id is being edited per entity
  const [editChild, setEditChild] = useState<ChildRow | null>(null);
  const [editTpl, setEditTpl] = useState<TplRow | null>(null);
  const [editReward, setEditReward] = useState<RewardRow | null>(null);

  function reload() {
    fetch("/api/children?all=1").then((r) => r.json()).then(setChildren);
    fetch("/api/templates?all=1").then((r) => r.json()).then(setTemplates);
    fetch("/api/rewards?all=1").then((r) => r.json()).then(setRewards);
  }
  useEffect(reload, []);

  async function addChild() {
    await fetch("/api/children", { method: "POST", body: JSON.stringify({ name: cName, grade: cGrade }) });
    setCName(""); reload();
  }
  async function saveChild() {
    if (!editChild) return;
    await fetch(`/api/children/${editChild.id}`, { method: "PATCH", body: JSON.stringify(editChild) });
    setEditChild(null); reload();
  }
  async function addTemplate() {
    await fetch("/api/templates", { method: "POST", body: JSON.stringify({ name: tName, subject: tSubject, defaultMinutes: tMinutes, basePoints: tPoints }) });
    setTName(""); reload();
  }
  async function saveTpl() {
    if (!editTpl) return;
    await fetch(`/api/templates/${editTpl.id}`, { method: "PATCH", body: JSON.stringify(editTpl) });
    setEditTpl(null); reload();
  }
  async function addReward() {
    await fetch("/api/rewards", { method: "POST", body: JSON.stringify({ name: rName, cost: rCost }) });
    setRName(""); reload();
  }
  async function saveReward() {
    if (!editReward) return;
    await fetch(`/api/rewards/${editReward.id}`, { method: "PATCH", body: JSON.stringify(editReward) });
    setEditReward(null); reload();
  }
  async function toggle(kind: string, id: number, action: "archive" | "restore") {
    await fetch(`/api/${kind}/${id}/${action}`, { method: "POST" });
    reload();
  }

  const activeChildren = children.filter((c) => c.archived === 0);
  const archivedChildren = children.filter((c) => c.archived === 1);
  const activeTpls = templates.filter((t) => t.archived === 0);
  const archivedTpls = templates.filter((t) => t.archived === 1);
  const activeRewards = rewards.filter((r) => r.active === 1);
  const archivedRewards = rewards.filter((r) => r.active === 0);

  return (
    <div className="space-y-8">
      {/* 孩子 */}
      <section>
        <h2 className="mb-2 font-semibold">孩子</h2>
        <ul className="mb-2 space-y-1">
          {activeChildren.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              {editChild?.id === c.id ? (
                <>
                  <input className="input w-28" value={editChild.name} onChange={(e) => setEditChild({ ...editChild, name: e.target.value })} />
                  <input type="number" className="input w-16" value={editChild.grade} onChange={(e) => setEditChild({ ...editChild, grade: +e.target.value })} />
                  <input className="input w-16" value={editChild.avatar} onChange={(e) => setEditChild({ ...editChild, avatar: e.target.value })} />
                  <button className="btn btn-emerald px-3 py-1 text-sm" onClick={saveChild}>保存</button>
                  <button className="text-sm text-slate-500" onClick={() => setEditChild(null)}>取消</button>
                </>
              ) : (
                <>
                  <span>{c.avatar} {c.name}（{c.grade} 年级）</span>
                  <button className="text-sm text-sky-600" onClick={() => setEditChild(c)}>编辑</button>
                  <button className="text-sm text-rose-500" onClick={() => toggle("children", c.id, "archive")}>归档</button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input placeholder="姓名" value={cName} onChange={(e) => setCName(e.target.value)} className="input" />
          <input type="number" value={cGrade} onChange={(e) => setCGrade(+e.target.value)} className="input w-16" />
          <button onClick={addChild} className="btn btn-primary px-3 py-1">添加</button>
        </div>
      </section>

      {/* 任务模板 */}
      <section>
        <h2 className="mb-2 font-semibold">任务模板</h2>
        <ul className="mb-2 space-y-1">
          {activeTpls.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              {editTpl?.id === t.id ? (
                <>
                  <input className="input w-40" value={editTpl.name} onChange={(e) => setEditTpl({ ...editTpl, name: e.target.value })} />
                  <select className="input" value={editTpl.subject} onChange={(e) => setEditTpl({ ...editTpl, subject: e.target.value })}>
                    {SUBJECTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <input type="number" className="input w-16" value={editTpl.defaultMinutes} onChange={(e) => setEditTpl({ ...editTpl, defaultMinutes: +e.target.value })} />
                  <input type="number" className="input w-16" value={editTpl.basePoints} onChange={(e) => setEditTpl({ ...editTpl, basePoints: +e.target.value })} />
                  <button className="btn btn-emerald px-3 py-1 text-sm" onClick={saveTpl}>保存</button>
                  <button className="text-sm text-slate-500" onClick={() => setEditTpl(null)}>取消</button>
                </>
              ) : (
                <>
                  <span className={`h-3 w-3 rounded-full ${SUBJECT_META[t.subject as keyof typeof SUBJECT_META]?.dot ?? "bg-slate-300"}`} />
                  <span>{t.name}（{t.basePoints}分 / {t.defaultMinutes}分钟）</span>
                  <button className="text-sm text-sky-600" onClick={() => setEditTpl(t)}>编辑</button>
                  <button className="text-sm text-rose-500" onClick={() => toggle("templates", t.id, "archive")}>归档</button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <input placeholder="任务名" value={tName} onChange={(e) => setTName(e.target.value)} className="input" />
          <select value={tSubject} onChange={(e) => setTSubject(e.target.value)} className="input">
            {SUBJECTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="number" value={tMinutes} onChange={(e) => setTMinutes(+e.target.value)} className="input w-20" placeholder="分钟" />
          <input type="number" value={tPoints} onChange={(e) => setTPoints(+e.target.value)} className="input w-20" placeholder="基础分" />
          <button onClick={addTemplate} className="btn btn-primary px-3 py-1">添加</button>
        </div>
      </section>

      {/* 奖励 */}
      <section>
        <h2 className="mb-2 font-semibold">奖励</h2>
        <ul className="mb-2 space-y-1">
          {activeRewards.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              {editReward?.id === r.id ? (
                <>
                  <input className="input w-40" value={editReward.name} onChange={(e) => setEditReward({ ...editReward, name: e.target.value })} />
                  <input type="number" className="input w-20" value={editReward.cost} onChange={(e) => setEditReward({ ...editReward, cost: +e.target.value })} />
                  <button className="btn btn-emerald px-3 py-1 text-sm" onClick={saveReward}>保存</button>
                  <button className="text-sm text-slate-500" onClick={() => setEditReward(null)}>取消</button>
                </>
              ) : (
                <>
                  <span>{r.name}（{r.cost} 分）</span>
                  <button className="text-sm text-sky-600" onClick={() => setEditReward(r)}>编辑</button>
                  <button className="text-sm text-rose-500" onClick={() => toggle("rewards", r.id, "archive")}>归档</button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input placeholder="奖励名" value={rName} onChange={(e) => setRName(e.target.value)} className="input" />
          <input type="number" value={rCost} onChange={(e) => setRCost(+e.target.value)} className="input w-24" />
          <button onClick={addReward} className="btn btn-primary px-3 py-1">新增奖励</button>
        </div>
      </section>

      {/* 已归档 */}
      <section>
        <h2 className="mb-2 font-semibold text-slate-500">已归档</h2>
        <ul className="space-y-1 text-sm text-slate-500">
          {archivedChildren.map((c) => (
            <li key={`c${c.id}`} className="flex items-center gap-2">
              <span>👶 {c.avatar} {c.name}</span>
              <button className="text-emerald-600" onClick={() => toggle("children", c.id, "restore")}>恢复</button>
            </li>
          ))}
          {archivedTpls.map((t) => (
            <li key={`t${t.id}`} className="flex items-center gap-2">
              <span>📝 {t.name}</span>
              <button className="text-emerald-600" onClick={() => toggle("templates", t.id, "restore")}>恢复</button>
            </li>
          ))}
          {archivedRewards.map((r) => (
            <li key={`r${r.id}`} className="flex items-center gap-2">
              <span>🎁 {r.name}</span>
              <button className="text-emerald-600" onClick={() => toggle("rewards", r.id, "restore")}>恢复</button>
            </li>
          ))}
          {archivedChildren.length + archivedTpls.length + archivedRewards.length === 0 && <li>（暂无已归档项）</li>}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: build 验证**

Run: `npx next build`
Expected: 编译通过。

Run: `npm test`
Expected: 全绿（UI 不影响测试）。

- [ ] **Step 3: 浏览器验证**

Run: `npm run dev`，打开 `/manage`
Expected: 可编辑孩子/模板/奖励并保存；可归档（项移入「已归档」区）；可恢复（移回活跃列表）。今日清单/奖励商店里归档项不再出现。

- [ ] **Step 4: 提交**

```bash
git add app/manage/page.tsx
git commit -m "feat: manage page edit/archive/restore UI"
```

---

## Self-Review

**Spec coverage（对照 2026-06-30-admin-crud-and-records-design.md 的「管理端 CRUD」部分）：**
- archived 列 + 旧库迁移 → Task 1 ✓
- 孩子 update/archive/restore + 活跃列表过滤 + listAll → Task 2 ✓
- 模板 update/archive/restore + 过滤 + listAll（getTemplate 不过滤，保 scoreTask）→ Task 3 ✓
- 奖励 update/archive/restore + listAll（listRewards 现状过滤 active）→ Task 4 ✓
- API：PATCH/archive/restore/?all=1 → Task 5 ✓
- /manage 编辑/归档/恢复/已归档区 → Task 6 ✓
- 归档项从派发下拉/奖励商店隐藏：由 `listChildren`/`listTemplates`/`listRewards` 过滤实现（今日页、奖励商店调用这些非 all 端点，无需改动它们）✓
- 记录/进度视图 → 不在本计划（Plan 2/2）。

**Placeholder scan：** 无 TBD/TODO；每个改动步骤含完整代码与命令。

**Type consistency：** `Child`/`TaskTemplate` 加 `archived: number`（Task 1）后，children/templates 仓储 `SELECT *`→`Child`/`Row` 映射含 archived（Task 2/3）；`updateChild({name,grade,avatar})`、`updateTemplate({name,subject,defaultMinutes,basePoints})`、`updateReward({name,cost})` 签名在仓储（Task 2-4）、API（Task 5）、UI（Task 6）一致；archive/restore 端点路径 `/api/<kind>/[id]/archive|restore` 在 API（Task 5）与 UI 的 `toggle()`（Task 6）一致。

**注：** 今日页 `app/page.tsx` 的 `Template` 接口在视觉主题任务中已把 `subject` 收窄为 `Subject`；本计划不改今日页，新增的 `archived` 字段不影响其按 templates 渲染。各页面散装类串由实现者读实际文件后按同语义替换。
