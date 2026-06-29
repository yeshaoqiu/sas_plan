# 家庭学习陪跑系统 — 里程碑 1（MVP）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 跑通「派任务 → 线下做 → 家长录入评分 → 得分兑奖」主线的本地网页应用。

**Architecture:** Next.js(App Router) + TypeScript 单体应用。业务逻辑全部放在可单元测试的纯函数/仓储层（`lib/`），数据存本地 SQLite（`better-sqlite3`）。API 路由是薄包装，UI 页面调用 API。积分余额由流水求和派生，不单独存字段。

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, better-sqlite3, Vitest。

## Global Constraints

- 语言：界面文案中文；代码标识符英文。
- 数据库：`better-sqlite3`（同步 API）。所有仓储函数第一个参数为 `db: Database.Database`，便于测试注入内存库。
- 测试：Vitest。逻辑层（`lib/`）必须有单元测试且用 `:memory:` 数据库；UI 页面以本地启动后浏览器验证作为测试环节。
- 积分余额：始终由 `point_entries.delta` 求和得出，绝不单独存储。
- 日期格式：`YYYY-MM-DD` 字符串。
- 科目枚举：`'writing' | 'picture_composition' | 'math' | 'other'`。
- 任务状态枚举：`'pending' | 'done' | 'scored'`。
- 计分常量（`lib/scoring.ts` 内定义并导出）：`FOCUS_BONUS = 5`、`SCAFFOLD_BONUS = 5`、`CHECK_BONUS = 5`、`ERROR_PENALTY = 2`、`MIN_POINTS = 1`。

---

## File Structure

- `lib/db.ts` — 打开 SQLite 连接、执行 schema；导出 `createDb(filename)` 与单例 `getDb()`。
- `lib/schema.sql` — 所有建表语句。
- `lib/types.ts` — 共享 TypeScript 类型。
- `lib/scoring.ts` — 纯计分函数 `computePoints`。
- `lib/repositories/children.ts` — 孩子 CRUD。
- `lib/repositories/templates.ts` — 任务模板 CRUD。
- `lib/repositories/points.ts` — 积分流水写入与余额求和。
- `lib/repositories/tasks.ts` — 每日任务派发、查询、评分（评分时写积分流水）。
- `lib/repositories/rewards.ts` — 奖励 CRUD 与兑换。
- `app/api/**/route.ts` — 薄 API 包装。
- `app/page.tsx` — 今日清单（家长主操作）。
- `app/manage/page.tsx` — 孩子与任务模板管理。
- `app/rewards/page.tsx` — 奖励商店 + 余额。
- `scripts/seed.ts` — 初始化两个孩子、示例模板与奖励。
- `tests/**` — Vitest 测试。

---

### Task 1: 项目脚手架与测试环境

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `.gitignore`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: 可运行的 Next.js 应用；`npm test` 可执行 Vitest。

- [ ] **Step 1: 初始化项目并安装依赖**

```bash
npm init -y
npm install next@15 react react-dom better-sqlite3
npm install -D typescript @types/react @types/node @types/better-sqlite3 vitest tailwindcss postcss autoprefixer tsx
```

- [ ] **Step 2: 写配置文件**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "incremental": true,
    "paths": { "@/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};
export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
```

`tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

`postcss.config.mjs`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`app/layout.tsx`:
```tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "学习陪跑" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-slate-900">
        <nav className="flex gap-4 bg-white px-6 py-3 shadow-sm">
          <a href="/" className="font-semibold">今日清单</a>
          <a href="/rewards">奖励商店</a>
          <a href="/manage">管理</a>
        </nav>
        <main className="mx-auto max-w-3xl p-6">{children}</main>
      </body>
    </html>
  );
}
```

`.gitignore`:
```
node_modules/
.next/
data/
*.db
*.db-*
```

Add scripts to `package.json`:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "seed": "tsx scripts/seed.ts"
}
```

- [ ] **Step 3: 写冒烟测试**

`tests/smoke.test.ts`:
```ts
import { expect, test } from "vitest";
test("vitest runs", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test`
Expected: PASS（1 个测试通过）

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Vitest project"
```

---

### Task 2: 数据库连接与 schema

**Files:**
- Create: `lib/schema.sql`, `lib/db.ts`, `lib/types.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `createDb(filename: string): Database.Database` — 打开连接、执行 schema、开启外键。
  - `getDb(): Database.Database` — 进程内单例，路径取 `process.env.DB_PATH ?? "data/app.db"`。
  - `lib/types.ts` 导出所有共享类型（见下）。

- [ ] **Step 1: 写共享类型**

`lib/types.ts`:
```ts
export type Subject = "writing" | "picture_composition" | "math" | "other";
export type TaskStatus = "pending" | "done" | "scored";

export interface Child {
  id: number;
  name: string;
  grade: number;
  avatar: string;
}

export interface TaskTemplate {
  id: number;
  name: string;
  subject: Subject;
  defaultMinutes: number;
  basePoints: number;
}

export interface TaskInstance {
  id: number;
  childId: number;
  templateId: number;
  date: string;
  status: TaskStatus;
  actualMinutes: number | null;
  focused: number | null;     // 0/1
  usedScaffold: number | null; // 0/1
  didCheck: number | null;     // 0/1
  errorCount: number | null;
  note: string | null;
  pointsAwarded: number | null;
}

export interface PointEntry {
  id: number;
  childId: number;
  delta: number;
  reason: string;
  taskInstanceId: number | null;
  rewardId: number | null;
  createdAt: string;
}

export interface Reward {
  id: number;
  name: string;
  cost: number;
  active: number; // 0/1
}
```

- [ ] **Step 2: 写 schema**

`lib/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  grade INTEGER NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🐣'
);

CREATE TABLE IF NOT EXISTS task_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  default_minutes INTEGER NOT NULL,
  base_points INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS task_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id),
  template_id INTEGER NOT NULL REFERENCES task_templates(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  actual_minutes INTEGER,
  focused INTEGER,
  used_scaffold INTEGER,
  did_check INTEGER,
  error_count INTEGER,
  note TEXT,
  points_awarded INTEGER
);

CREATE TABLE IF NOT EXISTS point_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  task_instance_id INTEGER REFERENCES task_instances(id),
  reward_id INTEGER REFERENCES rewards(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cost INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
```

- [ ] **Step 3: 写 db.ts**

`lib/db.ts`:
```ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

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
  return db;
}

let _db: Database.Database | null = null;
export function getDb(): Database.Database {
  if (!_db) _db = createDb(process.env.DB_PATH ?? "data/app.db");
  return _db;
}
```

- [ ] **Step 4: 写失败测试**

`tests/db.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";

test("createDb creates all tables", () => {
  const db = createDb(":memory:");
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as { name: string }[];
  const names = rows.map((r) => r.name);
  for (const t of ["children", "task_templates", "task_instances", "point_entries", "rewards"]) {
    expect(names).toContain(t);
  }
});
```

- [ ] **Step 5: 运行测试**

Run: `npm test -- tests/db.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add SQLite schema and connection layer"
```

---

### Task 3: 孩子仓储（children）

**Files:**
- Create: `lib/repositories/children.ts`
- Test: `tests/children.test.ts`

**Interfaces:**
- Consumes: `createDb` (Task 2), `Child` 类型。
- Produces:
  - `createChild(db, input: { name: string; grade: number; avatar?: string }): Child`
  - `listChildren(db): Child[]`
  - `getChild(db, id: number): Child | undefined`

- [ ] **Step 1: 写失败测试**

`tests/children.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild, listChildren, getChild } from "@/lib/repositories/children";

test("create and list children", () => {
  const db = createDb(":memory:");
  const a = createChild(db, { name: "小明", grade: 1 });
  const b = createChild(db, { name: "小红", grade: 2, avatar: "🐰" });
  expect(a.id).toBeGreaterThan(0);
  expect(a.avatar).toBe("🐣"); // 默认头像
  expect(b.avatar).toBe("🐰");
  expect(listChildren(db)).toHaveLength(2);
  expect(getChild(db, a.id)?.name).toBe("小明");
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/children.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`lib/repositories/children.ts`:
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

export function listChildren(db: Database.Database): Child[] {
  return db.prepare("SELECT * FROM children ORDER BY id").all() as Child[];
}

export function getChild(db: Database.Database, id: number): Child | undefined {
  return db.prepare("SELECT * FROM children WHERE id = ?").get(id) as
    | Child
    | undefined;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/children.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add children repository"
```

---

### Task 4: 任务模板仓储（templates）

**Files:**
- Create: `lib/repositories/templates.ts`
- Test: `tests/templates.test.ts`

**Interfaces:**
- Consumes: `createDb`, `TaskTemplate`, `Subject` 类型。
- Produces:
  - `createTemplate(db, input: { name: string; subject: Subject; defaultMinutes: number; basePoints: number }): TaskTemplate`
  - `listTemplates(db): TaskTemplate[]`
  - `getTemplate(db, id: number): TaskTemplate | undefined`

- [ ] **Step 1: 写失败测试**

`tests/templates.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createTemplate, listTemplates, getTemplate } from "@/lib/repositories/templates";

test("create and list templates", () => {
  const db = createDb(":memory:");
  const t = createTemplate(db, {
    name: "认真写 5 个字",
    subject: "writing",
    defaultMinutes: 5,
    basePoints: 10,
  });
  expect(t.id).toBeGreaterThan(0);
  expect(t.subject).toBe("writing");
  expect(listTemplates(db)).toHaveLength(1);
  expect(getTemplate(db, t.id)?.basePoints).toBe(10);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/templates.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/repositories/templates.ts`:
```ts
import type Database from "better-sqlite3";
import type { Subject, TaskTemplate } from "@/lib/types";

interface Row {
  id: number;
  name: string;
  subject: Subject;
  default_minutes: number;
  base_points: number;
}

function toTemplate(r: Row): TaskTemplate {
  return {
    id: r.id,
    name: r.name,
    subject: r.subject,
    defaultMinutes: r.default_minutes,
    basePoints: r.base_points,
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

export function listTemplates(db: Database.Database): TaskTemplate[] {
  const rows = db.prepare("SELECT * FROM task_templates ORDER BY id").all() as Row[];
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

Run: `npm test -- tests/templates.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add task templates repository"
```

---

### Task 5: 计分纯函数（scoring）

**Files:**
- Create: `lib/scoring.ts`
- Test: `tests/scoring.test.ts`

**Interfaces:**
- Consumes: 无（纯函数）。
- Produces:
  - 常量 `FOCUS_BONUS=5`, `SCAFFOLD_BONUS=5`, `CHECK_BONUS=5`, `ERROR_PENALTY=2`, `MIN_POINTS=1`。
  - `computePoints(input: { basePoints: number; focused: boolean; usedScaffold: boolean; didCheck: boolean; errorCount: number }): number`
  - 规则：`base + 各 bonus - errorCount*ERROR_PENALTY`，结果不低于 `MIN_POINTS`。

- [ ] **Step 1: 写失败测试**

`tests/scoring.test.ts`:
```ts
import { expect, test } from "vitest";
import { computePoints } from "@/lib/scoring";

test("base only", () => {
  expect(computePoints({ basePoints: 10, focused: false, usedScaffold: false, didCheck: false, errorCount: 0 })).toBe(10);
});

test("all bonuses add up", () => {
  expect(computePoints({ basePoints: 10, focused: true, usedScaffold: true, didCheck: true, errorCount: 0 })).toBe(25);
});

test("errors apply penalty", () => {
  expect(computePoints({ basePoints: 10, focused: false, usedScaffold: false, didCheck: false, errorCount: 3 })).toBe(4);
});

test("never below MIN_POINTS", () => {
  expect(computePoints({ basePoints: 2, focused: false, usedScaffold: false, didCheck: false, errorCount: 10 })).toBe(1);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/scoring.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/scoring.ts`:
```ts
export const FOCUS_BONUS = 5;
export const SCAFFOLD_BONUS = 5;
export const CHECK_BONUS = 5;
export const ERROR_PENALTY = 2;
export const MIN_POINTS = 1;

export function computePoints(input: {
  basePoints: number;
  focused: boolean;
  usedScaffold: boolean;
  didCheck: boolean;
  errorCount: number;
}): number {
  let points = input.basePoints;
  if (input.focused) points += FOCUS_BONUS;
  if (input.usedScaffold) points += SCAFFOLD_BONUS;
  if (input.didCheck) points += CHECK_BONUS;
  points -= input.errorCount * ERROR_PENALTY;
  return Math.max(MIN_POINTS, points);
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/scoring.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add scoring function"
```

---

### Task 6: 积分流水仓储（points）

**Files:**
- Create: `lib/repositories/points.ts`
- Test: `tests/points.test.ts`

**Interfaces:**
- Consumes: `createDb`, `createChild`, `PointEntry` 类型。
- Produces:
  - `addPointEntry(db, input: { childId: number; delta: number; reason: string; taskInstanceId?: number | null; rewardId?: number | null; now?: string }): PointEntry`
  - `getBalance(db, childId: number): number`
  - `listEntries(db, childId: number): PointEntry[]`（按时间倒序）
  - 说明：`now` 参数可注入时间戳便于测试；默认 `new Date().toISOString()`。

- [ ] **Step 1: 写失败测试**

`tests/points.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { addPointEntry, getBalance, listEntries } from "@/lib/repositories/points";

test("balance is sum of deltas", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  expect(getBalance(db, c.id)).toBe(0);
  addPointEntry(db, { childId: c.id, delta: 20, reason: "完成任务" });
  addPointEntry(db, { childId: c.id, delta: -5, reason: "兑换" });
  expect(getBalance(db, c.id)).toBe(15);
  expect(listEntries(db, c.id)).toHaveLength(2);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/points.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/repositories/points.ts`:
```ts
import type Database from "better-sqlite3";
import type { PointEntry } from "@/lib/types";

interface Row {
  id: number;
  child_id: number;
  delta: number;
  reason: string;
  task_instance_id: number | null;
  reward_id: number | null;
  created_at: string;
}

function toEntry(r: Row): PointEntry {
  return {
    id: r.id,
    childId: r.child_id,
    delta: r.delta,
    reason: r.reason,
    taskInstanceId: r.task_instance_id,
    rewardId: r.reward_id,
    createdAt: r.created_at,
  };
}

export function addPointEntry(
  db: Database.Database,
  input: {
    childId: number;
    delta: number;
    reason: string;
    taskInstanceId?: number | null;
    rewardId?: number | null;
    now?: string;
  },
): PointEntry {
  const createdAt = input.now ?? new Date().toISOString();
  const info = db
    .prepare(
      "INSERT INTO point_entries (child_id, delta, reason, task_instance_id, reward_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      input.childId,
      input.delta,
      input.reason,
      input.taskInstanceId ?? null,
      input.rewardId ?? null,
      createdAt,
    );
  const r = db
    .prepare("SELECT * FROM point_entries WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as Row;
  return toEntry(r);
}

export function getBalance(db: Database.Database, childId: number): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(delta), 0) AS bal FROM point_entries WHERE child_id = ?")
    .get(childId) as { bal: number };
  return row.bal;
}

export function listEntries(db: Database.Database, childId: number): PointEntry[] {
  const rows = db
    .prepare("SELECT * FROM point_entries WHERE child_id = ? ORDER BY id DESC")
    .all(childId) as Row[];
  return rows.map(toEntry);
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/points.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add point entries repository"
```

---

### Task 7: 每日任务仓储（tasks）

**Files:**
- Create: `lib/repositories/tasks.ts`
- Test: `tests/tasks.test.ts`

**Interfaces:**
- Consumes: `createDb`, `getTemplate` (Task 4), `computePoints` (Task 5), `addPointEntry` (Task 6)；类型 `TaskInstance`。
- Produces:
  - `assignTask(db, input: { childId: number; templateId: number; date: string }): TaskInstance`（status='pending'）
  - `listTasks(db, childId: number, date: string): TaskInstance[]`
  - `scoreTask(db, taskId: number, result: { actualMinutes: number; focused: boolean; usedScaffold: boolean; didCheck: boolean; errorCount: number; note?: string; now?: string }): TaskInstance`
    - 用 `computePoints` 计算得分，写入 `task_instances`（status='scored', points_awarded），并调用 `addPointEntry` 记一条正向流水（reason=`完成任务: <模板名>`）。
    - 若任务已是 `scored`，抛出 `Error("任务已评分")`（防止重复加分）。

- [ ] **Step 1: 写失败测试**

`tests/tasks.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { assignTask, listTasks, scoreTask } from "@/lib/repositories/tasks";
import { getBalance } from "@/lib/repositories/points";

function setup() {
  const db = createDb(":memory:");
  const child = createChild(db, { name: "小明", grade: 1 });
  const tpl = createTemplate(db, {
    name: "认真写 5 个字",
    subject: "writing",
    defaultMinutes: 5,
    basePoints: 10,
  });
  return { db, child, tpl };
}

test("assign then list", () => {
  const { db, child, tpl } = setup();
  assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-06-29" });
  const tasks = listTasks(db, child.id, "2026-06-29");
  expect(tasks).toHaveLength(1);
  expect(tasks[0].status).toBe("pending");
});

test("scoring writes points and updates status", () => {
  const { db, child, tpl } = setup();
  const t = assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-06-29" });
  const scored = scoreTask(db, t.id, {
    actualMinutes: 6,
    focused: true,
    usedScaffold: false,
    didCheck: false,
    errorCount: 0,
  });
  expect(scored.status).toBe("scored");
  expect(scored.pointsAwarded).toBe(15); // 10 base + 5 focus
  expect(getBalance(db, child.id)).toBe(15);
});

test("cannot score twice", () => {
  const { db, child, tpl } = setup();
  const t = assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-06-29" });
  scoreTask(db, t.id, { actualMinutes: 5, focused: false, usedScaffold: false, didCheck: false, errorCount: 0 });
  expect(() =>
    scoreTask(db, t.id, { actualMinutes: 5, focused: false, usedScaffold: false, didCheck: false, errorCount: 0 }),
  ).toThrow("任务已评分");
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/tasks.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/repositories/tasks.ts`:
```ts
import type Database from "better-sqlite3";
import type { TaskInstance } from "@/lib/types";
import { getTemplate } from "@/lib/repositories/templates";
import { computePoints } from "@/lib/scoring";
import { addPointEntry } from "@/lib/repositories/points";

interface Row {
  id: number;
  child_id: number;
  template_id: number;
  date: string;
  status: TaskInstance["status"];
  actual_minutes: number | null;
  focused: number | null;
  used_scaffold: number | null;
  did_check: number | null;
  error_count: number | null;
  note: string | null;
  points_awarded: number | null;
}

function toTask(r: Row): TaskInstance {
  return {
    id: r.id,
    childId: r.child_id,
    templateId: r.template_id,
    date: r.date,
    status: r.status,
    actualMinutes: r.actual_minutes,
    focused: r.focused,
    usedScaffold: r.used_scaffold,
    didCheck: r.did_check,
    errorCount: r.error_count,
    note: r.note,
    pointsAwarded: r.points_awarded,
  };
}

function getTask(db: Database.Database, id: number): TaskInstance | undefined {
  const r = db.prepare("SELECT * FROM task_instances WHERE id = ?").get(id) as
    | Row
    | undefined;
  return r ? toTask(r) : undefined;
}

export function assignTask(
  db: Database.Database,
  input: { childId: number; templateId: number; date: string },
): TaskInstance {
  const info = db
    .prepare(
      "INSERT INTO task_instances (child_id, template_id, date, status) VALUES (?, ?, ?, 'pending')",
    )
    .run(input.childId, input.templateId, input.date);
  return getTask(db, Number(info.lastInsertRowid))!;
}

export function listTasks(
  db: Database.Database,
  childId: number,
  date: string,
): TaskInstance[] {
  const rows = db
    .prepare("SELECT * FROM task_instances WHERE child_id = ? AND date = ? ORDER BY id")
    .all(childId, date) as Row[];
  return rows.map(toTask);
}

export function scoreTask(
  db: Database.Database,
  taskId: number,
  result: {
    actualMinutes: number;
    focused: boolean;
    usedScaffold: boolean;
    didCheck: boolean;
    errorCount: number;
    note?: string;
    now?: string;
  },
): TaskInstance {
  const task = getTask(db, taskId);
  if (!task) throw new Error("任务不存在");
  if (task.status === "scored") throw new Error("任务已评分");
  const tpl = getTemplate(db, task.templateId);
  if (!tpl) throw new Error("任务模板不存在");

  const points = computePoints({
    basePoints: tpl.basePoints,
    focused: result.focused,
    usedScaffold: result.usedScaffold,
    didCheck: result.didCheck,
    errorCount: result.errorCount,
  });

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE task_instances SET status='scored', actual_minutes=?, focused=?, used_scaffold=?, did_check=?, error_count=?, note=?, points_awarded=? WHERE id=?`,
    ).run(
      result.actualMinutes,
      result.focused ? 1 : 0,
      result.usedScaffold ? 1 : 0,
      result.didCheck ? 1 : 0,
      result.errorCount,
      result.note ?? null,
      points,
      taskId,
    );
    addPointEntry(db, {
      childId: task.childId,
      delta: points,
      reason: `完成任务: ${tpl.name}`,
      taskInstanceId: taskId,
      now: result.now,
    });
  });
  tx();
  return getTask(db, taskId)!;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/tasks.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add task instances repository with scoring"
```

---

### Task 8: 奖励仓储与兑换（rewards）

**Files:**
- Create: `lib/repositories/rewards.ts`
- Test: `tests/rewards.test.ts`

**Interfaces:**
- Consumes: `createDb`, `createChild`, `addPointEntry`, `getBalance`；类型 `Reward`。
- Produces:
  - `createReward(db, input: { name: string; cost: number }): Reward`（active=1）
  - `listRewards(db): Reward[]`（仅 active）
  - `redeemReward(db, input: { childId: number; rewardId: number; now?: string }): { balance: number }`
    - 余额不足抛出 `Error("积分不足")`；否则写一条负向流水（reason=`兑换: <奖励名>`），返回新余额。

- [ ] **Step 1: 写失败测试**

`tests/rewards.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { addPointEntry, getBalance } from "@/lib/repositories/points";
import { createReward, listRewards, redeemReward } from "@/lib/repositories/rewards";

test("create and list rewards", () => {
  const db = createDb(":memory:");
  createReward(db, { name: "看动画30分钟", cost: 30 });
  expect(listRewards(db)).toHaveLength(1);
});

test("redeem deducts points", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const r = createReward(db, { name: "看动画30分钟", cost: 30 });
  addPointEntry(db, { childId: c.id, delta: 50, reason: "完成任务" });
  const res = redeemReward(db, { childId: c.id, rewardId: r.id });
  expect(res.balance).toBe(20);
  expect(getBalance(db, c.id)).toBe(20);
});

test("redeem fails when insufficient", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const r = createReward(db, { name: "出游", cost: 100 });
  addPointEntry(db, { childId: c.id, delta: 10, reason: "完成任务" });
  expect(() => redeemReward(db, { childId: c.id, rewardId: r.id })).toThrow("积分不足");
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/rewards.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/repositories/rewards.ts`:
```ts
import type Database from "better-sqlite3";
import type { Reward } from "@/lib/types";
import { addPointEntry, getBalance } from "@/lib/repositories/points";

export function createReward(
  db: Database.Database,
  input: { name: string; cost: number },
): Reward {
  const info = db
    .prepare("INSERT INTO rewards (name, cost, active) VALUES (?, ?, 1)")
    .run(input.name, input.cost);
  return db
    .prepare("SELECT * FROM rewards WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as Reward;
}

export function listRewards(db: Database.Database): Reward[] {
  return db
    .prepare("SELECT * FROM rewards WHERE active = 1 ORDER BY cost")
    .all() as Reward[];
}

export function redeemReward(
  db: Database.Database,
  input: { childId: number; rewardId: number; now?: string },
): { balance: number } {
  const reward = db
    .prepare("SELECT * FROM rewards WHERE id = ?")
    .get(input.rewardId) as Reward | undefined;
  if (!reward) throw new Error("奖励不存在");
  if (getBalance(db, input.childId) < reward.cost) throw new Error("积分不足");
  addPointEntry(db, {
    childId: input.childId,
    delta: -reward.cost,
    reason: `兑换: ${reward.name}`,
    rewardId: reward.id,
    now: input.now,
  });
  return { balance: getBalance(db, input.childId) };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/rewards.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add rewards repository with redeem"
```

---

### Task 9: API 路由层

**Files:**
- Create: `app/api/children/route.ts`, `app/api/templates/route.ts`, `app/api/tasks/route.ts`, `app/api/tasks/[id]/score/route.ts`, `app/api/rewards/route.ts`, `app/api/rewards/[id]/redeem/route.ts`, `app/api/children/[id]/balance/route.ts`
- Test: `tests/api-children.test.ts`

**Interfaces:**
- Consumes: 所有仓储函数 + `getDb`。
- Produces: REST 端点（JSON）。每个 handler 仅做：解析输入 → 调仓储 → 返回 `NextResponse.json`，错误返回 `{ error }` 与 400。

- [ ] **Step 1: 写 children API**

`app/api/children/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createChild, listChildren } from "@/lib/repositories/children";

export async function GET() {
  return NextResponse.json(listChildren(getDb()));
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

- [ ] **Step 2: 写 templates API**

`app/api/templates/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createTemplate, listTemplates } from "@/lib/repositories/templates";

export async function GET() {
  return NextResponse.json(listTemplates(getDb()));
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

- [ ] **Step 3: 写 tasks API**

`app/api/tasks/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { assignTask, listTasks } from "@/lib/repositories/tasks";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const childId = Number(searchParams.get("childId"));
  const date = searchParams.get("date") ?? "";
  return NextResponse.json(listTasks(getDb(), childId, date));
}

export async function POST(req: Request) {
  const body = await req.json();
  const task = assignTask(getDb(), {
    childId: Number(body.childId),
    templateId: Number(body.templateId),
    date: body.date,
  });
  return NextResponse.json(task);
}
```

`app/api/tasks/[id]/score/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { scoreTask } from "@/lib/repositories/tasks";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  try {
    const task = scoreTask(getDb(), Number(id), {
      actualMinutes: Number(body.actualMinutes),
      focused: !!body.focused,
      usedScaffold: !!body.usedScaffold,
      didCheck: !!body.didCheck,
      errorCount: Number(body.errorCount ?? 0),
      note: body.note,
    });
    return NextResponse.json(task);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 4: 写 rewards 与 balance API**

`app/api/rewards/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createReward, listRewards } from "@/lib/repositories/rewards";

export async function GET() {
  return NextResponse.json(listRewards(getDb()));
}

export async function POST(req: Request) {
  const body = await req.json();
  const reward = createReward(getDb(), { name: body.name, cost: Number(body.cost) });
  return NextResponse.json(reward);
}
```

`app/api/rewards/[id]/redeem/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { redeemReward } from "@/lib/repositories/rewards";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  try {
    const res = redeemReward(getDb(), {
      childId: Number(body.childId),
      rewardId: Number(id),
    });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

`app/api/children/[id]/balance/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getBalance } from "@/lib/repositories/points";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json({ balance: getBalance(getDb(), Number(id)) });
}
```

- [ ] **Step 5: 写 API 集成测试（直接调用 handler）**

`tests/api-children.test.ts`:
```ts
import { afterAll, expect, test } from "vitest";
import fs from "node:fs";

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

afterAll(() => {
  for (const f of fs.readdirSync("data").filter((f) => f.startsWith("app.db"))) {
    // no-op: :memory: 不落盘；占位以示清理意图
    void f;
  }
});
```

> 注：`getDb()` 单例在测试进程内复用 `:memory:` 库；本测试只验证 handler 串联正确，逻辑细节已由仓储测试覆盖。

- [ ] **Step 6: 运行测试，确认通过**

Run: `npm test -- tests/api-children.test.ts`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: add API routes"
```

---

### Task 10: 今日清单页面（家长主操作）

**Files:**
- Create: `app/page.tsx`, `app/_components/ScoreForm.tsx`
- 验证：浏览器手动验证

**Interfaces:**
- Consumes: `/api/children`, `/api/tasks`, `/api/tasks/[id]/score`, `/api/templates`。
- Produces: 选孩子 + 选日期 → 列出当日任务 → 派发新任务 → 对任务录入结果评分的页面。

- [ ] **Step 1: 写评分表单组件**

`app/_components/ScoreForm.tsx`:
```tsx
"use client";
import { useState } from "react";

export function ScoreForm({ taskId, onDone }: { taskId: number; onDone: () => void }) {
  const [actualMinutes, setMinutes] = useState(5);
  const [focused, setFocused] = useState(false);
  const [usedScaffold, setScaffold] = useState(false);
  const [didCheck, setCheck] = useState(false);
  const [errorCount, setErrors] = useState(0);
  const [note, setNote] = useState("");

  async function submit() {
    const res = await fetch(`/api/tasks/${taskId}/score`, {
      method: "POST",
      body: JSON.stringify({ actualMinutes, focused, usedScaffold, didCheck, errorCount, note }),
    });
    if (!res.ok) {
      alert((await res.json()).error);
      return;
    }
    onDone();
  }

  return (
    <div className="mt-2 space-y-2 rounded bg-slate-100 p-3 text-sm">
      <label className="block">用时(分钟)
        <input type="number" value={actualMinutes} onChange={(e) => setMinutes(+e.target.value)} className="ml-2 w-16 rounded border px-1" />
      </label>
      <label className="mr-3"><input type="checkbox" checked={focused} onChange={(e) => setFocused(e.target.checked)} /> 专注完成</label>
      <label className="mr-3"><input type="checkbox" checked={usedScaffold} onChange={(e) => setScaffold(e.target.checked)} /> 用上支架</label>
      <label className="mr-3"><input type="checkbox" checked={didCheck} onChange={(e) => setCheck(e.target.checked)} /> 做了检查</label>
      <label className="block">错题数
        <input type="number" value={errorCount} onChange={(e) => setErrors(+e.target.value)} className="ml-2 w-16 rounded border px-1" />
      </label>
      <input placeholder="备注" value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border px-2 py-1" />
      <button onClick={submit} className="rounded bg-emerald-500 px-3 py-1 text-white">保存评分</button>
    </div>
  );
}
```

- [ ] **Step 2: 写今日清单页面**

`app/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { ScoreForm } from "./_components/ScoreForm";

interface Child { id: number; name: string; avatar: string }
interface Template { id: number; name: string; subject: string }
interface Task { id: number; templateId: number; status: string; pointsAwarded: number | null }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Home() {
  const [children, setChildren] = useState<Child[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [scoring, setScoring] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/children").then((r) => r.json()).then((c) => {
      setChildren(c);
      if (c[0]) setChildId(c[0].id);
    });
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
  }, []);

  async function loadTasks() {
    if (!childId) return;
    const t = await fetch(`/api/tasks?childId=${childId}&date=${date}`).then((r) => r.json());
    setTasks(t);
  }
  useEffect(() => { loadTasks(); }, [childId, date]);

  async function assign(templateId: number) {
    await fetch("/api/tasks", { method: "POST", body: JSON.stringify({ childId, templateId, date }) });
    loadTasks();
  }

  const tplName = (id: number) => templates.find((t) => t.id === id)?.name ?? "?";

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={childId ?? ""} onChange={(e) => setChildId(+e.target.value)} className="rounded border px-2 py-1">
          {children.map((c) => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border px-2 py-1" />
      </div>

      <div>
        <h2 className="mb-2 font-semibold">派发任务</h2>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <button key={t.id} onClick={() => assign(t.id)} className="rounded bg-sky-500 px-3 py-1 text-sm text-white">+ {t.name}</button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">今日任务</h2>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="rounded bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span>{tplName(t.templateId)}</span>
                {t.status === "scored"
                  ? <span className="text-emerald-600">已评分 +{t.pointsAwarded}</span>
                  : <button onClick={() => setScoring(scoring === t.id ? null : t.id)} className="rounded bg-amber-500 px-2 py-1 text-sm text-white">评分</button>}
              </div>
              {scoring === t.id && <ScoreForm taskId={t.id} onDone={() => { setScoring(null); loadTasks(); }} />}
            </li>
          ))}
          {tasks.length === 0 && <li className="text-slate-500">还没有任务，点上面派发。</li>}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 浏览器验证**

Run: `npm run seed && npm run dev`，浏览器打开 `http://localhost:3000`
Expected: 能选孩子、派发任务、点"评分"填表保存后显示"已评分 +N"。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: add today task list page"
```

---

### Task 11: 管理页面（孩子 + 任务模板）

**Files:**
- Create: `app/manage/page.tsx`
- 验证：浏览器手动验证

**Interfaces:**
- Consumes: `/api/children`, `/api/templates`。
- Produces: 新增/查看孩子与任务模板的页面。

- [ ] **Step 1: 写管理页面**

`app/manage/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";

const SUBJECTS = [
  { value: "writing", label: "写字" },
  { value: "picture_composition", label: "看图写话" },
  { value: "math", label: "数学" },
  { value: "other", label: "其他" },
];

export default function Manage() {
  const [children, setChildren] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [cName, setCName] = useState("");
  const [cGrade, setCGrade] = useState(1);
  const [tName, setTName] = useState("");
  const [tSubject, setTSubject] = useState("writing");
  const [tMinutes, setTMinutes] = useState(5);
  const [tPoints, setTPoints] = useState(10);

  function reload() {
    fetch("/api/children").then((r) => r.json()).then(setChildren);
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
  }
  useEffect(reload, []);

  async function addChild() {
    await fetch("/api/children", { method: "POST", body: JSON.stringify({ name: cName, grade: cGrade }) });
    setCName(""); reload();
  }
  async function addTemplate() {
    await fetch("/api/templates", { method: "POST", body: JSON.stringify({ name: tName, subject: tSubject, defaultMinutes: tMinutes, basePoints: tPoints }) });
    setTName(""); reload();
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-semibold">孩子</h2>
        <ul className="mb-2">{children.map((c) => <li key={c.id}>{c.avatar} {c.name}（{c.grade} 年级）</li>)}</ul>
        <div className="flex gap-2">
          <input placeholder="姓名" value={cName} onChange={(e) => setCName(e.target.value)} className="rounded border px-2 py-1" />
          <input type="number" value={cGrade} onChange={(e) => setCGrade(+e.target.value)} className="w-16 rounded border px-2 py-1" />
          <button onClick={addChild} className="rounded bg-sky-500 px-3 py-1 text-white">添加</button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">任务模板</h2>
        <ul className="mb-2">{templates.map((t) => <li key={t.id}>{t.name}（{t.basePoints}分 / {t.defaultMinutes}分钟）</li>)}</ul>
        <div className="flex flex-wrap gap-2">
          <input placeholder="任务名" value={tName} onChange={(e) => setTName(e.target.value)} className="rounded border px-2 py-1" />
          <select value={tSubject} onChange={(e) => setTSubject(e.target.value)} className="rounded border px-2 py-1">
            {SUBJECTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="number" value={tMinutes} onChange={(e) => setTMinutes(+e.target.value)} className="w-20 rounded border px-2 py-1" placeholder="分钟" />
          <input type="number" value={tPoints} onChange={(e) => setTPoints(+e.target.value)} className="w-20 rounded border px-2 py-1" placeholder="基础分" />
          <button onClick={addTemplate} className="rounded bg-sky-500 px-3 py-1 text-white">添加</button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 浏览器验证**

Run: `npm run dev`，打开 `http://localhost:3000/manage`
Expected: 能添加孩子和任务模板，列表即时刷新。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: add manage page for children and templates"
```

---

### Task 12: 奖励商店 + 余额页面

**Files:**
- Create: `app/rewards/page.tsx`
- 验证：浏览器手动验证

**Interfaces:**
- Consumes: `/api/children`, `/api/children/[id]/balance`, `/api/rewards`, `/api/rewards/[id]/redeem`。
- Produces: 显示所选孩子积分余额、奖励列表、兑换按钮，以及新增奖励。

- [ ] **Step 1: 写奖励页面**

`app/rewards/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";

export default function Rewards() {
  const [children, setChildren] = useState<any[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<any[]>([]);
  const [rName, setRName] = useState("");
  const [rCost, setRCost] = useState(30);

  useEffect(() => {
    fetch("/api/children").then((r) => r.json()).then((c) => {
      setChildren(c);
      if (c[0]) setChildId(c[0].id);
    });
    fetch("/api/rewards").then((r) => r.json()).then(setRewards);
  }, []);

  async function loadBalance() {
    if (!childId) return;
    const b = await fetch(`/api/children/${childId}/balance`).then((r) => r.json());
    setBalance(b.balance);
  }
  useEffect(() => { loadBalance(); }, [childId]);

  async function redeem(rewardId: number) {
    const res = await fetch(`/api/rewards/${rewardId}/redeem`, { method: "POST", body: JSON.stringify({ childId }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    loadBalance();
  }
  async function addReward() {
    await fetch("/api/rewards", { method: "POST", body: JSON.stringify({ name: rName, cost: rCost }) });
    setRName("");
    fetch("/api/rewards").then((r) => r.json()).then(setRewards);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <select value={childId ?? ""} onChange={(e) => setChildId(+e.target.value)} className="rounded border px-2 py-1">
          {children.map((c) => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
        </select>
        <span className="text-2xl font-bold text-amber-500">⭐ {balance}</span>
      </div>

      <ul className="space-y-2">
        {rewards.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded bg-white p-3 shadow-sm">
            <span>{r.name}（{r.cost} 分）</span>
            <button onClick={() => redeem(r.id)} disabled={balance < r.cost} className="rounded bg-rose-500 px-3 py-1 text-white disabled:bg-slate-300">兑换</button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <input placeholder="奖励名" value={rName} onChange={(e) => setRName(e.target.value)} className="rounded border px-2 py-1" />
        <input type="number" value={rCost} onChange={(e) => setRCost(+e.target.value)} className="w-24 rounded border px-2 py-1" />
        <button onClick={addReward} className="rounded bg-sky-500 px-3 py-1 text-white">新增奖励</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 浏览器验证**

Run: `npm run dev`，打开 `http://localhost:3000/rewards`
Expected: 显示余额；积分足够才能兑换；兑换后余额减少。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: add reward shop and balance page"
```

---

### Task 13: 种子数据与使用说明

**Files:**
- Create: `scripts/seed.ts`, `README.md`
- 验证：运行 seed 后数据可见

**Interfaces:**
- Consumes: `getDb`, 各仓储 `create*` 函数。
- Produces: 两个孩子 + 针对三弱点的示例模板 + 示例奖励。

- [ ] **Step 1: 写 seed 脚本**

`scripts/seed.ts`:
```ts
import { getDb } from "@/lib/db";
import { createChild, listChildren } from "@/lib/repositories/children";
import { createTemplate, listTemplates } from "@/lib/repositories/templates";
import { createReward, listRewards } from "@/lib/repositories/rewards";

const db = getDb();

if (listChildren(db).length === 0) {
  createChild(db, { name: "老大", grade: 2, avatar: "🐯" });
  createChild(db, { name: "老二", grade: 1, avatar: "🐰" });
}

if (listTemplates(db).length === 0) {
  createTemplate(db, { name: "认真写 5 个字（专注番茄钟）", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  createTemplate(db, { name: "看图写话：谁/在哪/做什么/怎么样/心情", subject: "picture_composition", defaultMinutes: 10, basePoints: 12 });
  createTemplate(db, { name: "口算 10 题（做完检查）", subject: "math", defaultMinutes: 8, basePoints: 10 });
}

if (listRewards(db).length === 0) {
  createReward(db, { name: "看动画 30 分钟", cost: 30 });
  createReward(db, { name: "选一次周末活动", cost: 80 });
  createReward(db, { name: "买一本想要的书", cost: 120 });
}

console.log("seed done:", {
  children: listChildren(db).length,
  templates: listTemplates(db).length,
  rewards: listRewards(db).length,
});
```

- [ ] **Step 2: 运行 seed，确认输出**

Run: `npm run seed`
Expected: 打印 `seed done: { children: 2, templates: 3, rewards: 3 }`

- [ ] **Step 3: 写 README**

`README.md`:
```markdown
# 家庭学习陪跑系统

线下练、线上记的家庭学习陪跑应用。

## 运行

\`\`\`bash
npm install
npm run seed   # 首次：初始化两个孩子、示例任务模板与奖励
npm run dev    # 启动，浏览器打开 http://localhost:3000
\`\`\`

数据存放在本地 `data/app.db`（SQLite），不上传任何服务器。

## 页面
- `/`：今日清单 — 派发任务、录入结果与评分
- `/rewards`：奖励商店 — 查看积分余额、兑换奖励
- `/manage`：管理 — 新增孩子与任务模板

## 测试
\`\`\`bash
npm test
\`\`\`
```

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: add seed script and README"
```

---

## Self-Review

**Spec coverage（里程碑 1 范围）：**
- 孩子/任务模板/每日任务录入评分 → Task 3、4、7、10、11 ✓
- 积分兑换商店 → Task 8、12 ✓
- 今日清单 → Task 10 ✓
- 针对三弱点的任务设计（专注/支架/检查的加分项与错题扣分）→ Task 5 计分逻辑 + Task 10 评分表单 + Task 13 种子模板 ✓
- 本地 SQLite、Next.js 技术栈 → Task 1、2 ✓
- 里程碑 2-4（周报/规则引擎/养成/排行榜/AI）→ 不在本计划，后续各自出计划（符合 YAGNI）。

**Placeholder scan：** 无 TBD/TODO；所有代码步骤含完整代码与可运行命令。

**Type consistency：** `computePoints` 入参在 Task 5 定义、Task 7 调用一致；仓储函数名（`createChild`/`listChildren`/`getChild`、`assignTask`/`listTasks`/`scoreTask`、`addPointEntry`/`getBalance`、`createReward`/`listRewards`/`redeemReward`）在定义与调用处一致；DB 列名（snake_case）与 TS 字段（camelCase）在各仓储 `toX` 映射函数内转换一致。
