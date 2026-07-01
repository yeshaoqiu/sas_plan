# 可配置评分：数据模型 + 计分引擎 实现计划 — Plan 1/3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把评分从写死常量改为数据表驱动：自定义加分项 + 可配评分设置 + 用时按时加分。

**Architecture:** 新表 `bonus_items`/`task_bonus`/`scoring_settings`（`CREATE TABLE IF NOT EXISTS` 建于新库与既有库，`seedDefaults` 幂等种入现有三项与默认设置）。`computePoints` 重写为通用纯函数；`scoreTask` 重写：算按时加分、汇总已选加分项、写 `task_bonus`。score API 同步改入参以保持构建绿色（动态表单在 Plan 3）。

**Tech Stack:** Next.js 15 App Router, TypeScript, better-sqlite3, Vitest。

## Global Constraints

- 不引入新依赖；better-sqlite3 同步 API；仓储函数首参 `db`；snake↔camel 显式映射。
- 表经 `CREATE TABLE IF NOT EXISTS`（每次打开都跑，既有库自动补建）；种子经 `seedDefaults(db)`（在 createDb 内、runMigrations 之后调用；仅在空表/无设置行时插入）。
- 计分模型：`得分 = 基础分 + Σ已选加分项分值 + 按时加分(用时≤模板时长取 on_time_bonus 否则0) − 错题数×error_penalty`，`max(min_points, 得分)`。
- 默认种子：加分项「专注完成/用上支架/做了检查」各 +5（带说明）；`scoring_settings` = (on_time_bonus 3, error_penalty 2, min_points 1)。
- `scoreTask` 不再写 `focused/used_scaffold/did_check`（列保留、置空）。
- TDD；既有基于 focused/usedScaffold/didCheck 的评分测试按新模型重写。既有其余测试保持通过（本 plan 结束时 build + 全测试绿）。

---

## File Structure

- `lib/schema.sql` — 修改：加 `bonus_items`、`task_bonus`(+唯一索引)、`scoring_settings` 三表。
- `lib/db.ts` — 修改：加 `seedDefaults(db)`，createDb 内 `runMigrations` 后调用；导出 `seedDefaults`。
- `lib/types.ts` — 修改：加 `BonusItem`、`ScoringSettings` 类型。
- `lib/repositories/bonusItems.ts` — 新建：加分项 CRUD/归档。
- `lib/repositories/scoringSettings.ts` — 新建：get/update。
- `lib/repositories/tasks.ts` — 修改：`scoreTask` 重写、加 `listTaskBonus`；引入 scoringSettings。
- `lib/scoring.ts` — 修改：`computePoints` 重写。
- `app/api/tasks/[id]/score/route.ts` — 修改：入参改为 `{actualMinutes, bonusItemIds, errorCount, note}`。

---

### Task 1: 三表 + 种子 + 类型

**Files:**
- Modify: `lib/schema.sql`, `lib/db.ts`, `lib/types.ts`
- Test: `tests/scoring-schema.test.ts`

**Interfaces:**
- Consumes: `createDb`。
- Produces:
  - 表 `bonus_items(id,name,description,points,active,sort_order)`、`task_bonus(task_instance_id,bonus_item_id)` + 唯一索引、`scoring_settings(id,on_time_bonus,error_penalty,min_points)`。
  - `seedDefaults(db): void`（幂等：空则种 3 项加分项 + 默认设置行）。
  - 类型 `BonusItem { id; name; description; points; active: number; sortOrder: number }`、`ScoringSettings { onTimeBonus; errorPenalty; minPoints }`。

- [ ] **Step 1: schema 加三表**

在 `lib/schema.sql` 末尾追加：
```sql
CREATE TABLE IF NOT EXISTS bonus_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  points INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS task_bonus (
  task_instance_id INTEGER NOT NULL REFERENCES task_instances(id),
  bonus_item_id INTEGER NOT NULL REFERENCES bonus_items(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_bonus ON task_bonus(task_instance_id, bonus_item_id);

CREATE TABLE IF NOT EXISTS scoring_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  on_time_bonus INTEGER NOT NULL DEFAULT 3,
  error_penalty INTEGER NOT NULL DEFAULT 2,
  min_points INTEGER NOT NULL DEFAULT 1
);
```

- [ ] **Step 2: 类型**

在 `lib/types.ts` 追加：
```ts
export interface BonusItem {
  id: number;
  name: string;
  description: string;
  points: number;
  active: number;
  sortOrder: number;
}

export interface ScoringSettings {
  onTimeBonus: number;
  errorPenalty: number;
  minPoints: number;
}
```

- [ ] **Step 3: seedDefaults + 接线**

在 `lib/db.ts`：新增并导出 `seedDefaults`，并在 `createDb` 的 `runMigrations(db)` 之后调用它。新增函数：
```ts
export function seedDefaults(db: Database.Database): void {
  const bonusCount = (
    db.prepare("SELECT COUNT(*) AS n FROM bonus_items").get() as { n: number }
  ).n;
  if (bonusCount === 0) {
    const ins = db.prepare(
      "INSERT INTO bonus_items (name, description, points, active, sort_order) VALUES (?, ?, ?, 1, ?)",
    );
    ins.run("专注完成", "这次做题没分心、专注做完（尤其写字）。", 5, 0);
    ins.run("用上支架", "看图写话用上了结构支架（谁/在哪/做什么/怎么样/心情）。", 5, 1);
    ins.run("做了检查", "做完后做了复核/检查这一步。", 5, 2);
  }
  const hasSettings = db.prepare("SELECT 1 FROM scoring_settings WHERE id = 1").get();
  if (!hasSettings) {
    db.prepare(
      "INSERT INTO scoring_settings (id, on_time_bonus, error_penalty, min_points) VALUES (1, 3, 2, 1)",
    ).run();
  }
}
```
在 `createDb` 内：
```ts
  db.exec(schema);
  runMigrations(db);
  seedDefaults(db);
  return db;
```
（注意：`seedDefaults` 只在 `createDb` 调用；不要放进 `runMigrations`，以免 `tests/migration.test.ts` 的裸库直调 runMigrations 时因缺表报错。）

- [ ] **Step 4: 写失败测试**

`tests/scoring-schema.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb, seedDefaults } from "@/lib/db";

test("seeds three default bonus items with descriptions and points", () => {
  const db = createDb(":memory:");
  const rows = db.prepare("SELECT name, points, description FROM bonus_items ORDER BY sort_order").all() as { name: string; points: number; description: string }[];
  expect(rows.map((r) => r.name)).toEqual(["专注完成", "用上支架", "做了检查"]);
  expect(rows.every((r) => r.points === 5)).toBe(true);
  expect(rows.every((r) => r.description.length > 0)).toBe(true);
});

test("seeds default scoring_settings row", () => {
  const db = createDb(":memory:");
  const s = db.prepare("SELECT on_time_bonus, error_penalty, min_points FROM scoring_settings WHERE id = 1").get() as { on_time_bonus: number; error_penalty: number; min_points: number };
  expect(s).toEqual({ on_time_bonus: 3, error_penalty: 2, min_points: 1 });
});

test("seedDefaults is idempotent", () => {
  const db = createDb(":memory:");
  seedDefaults(db);
  seedDefaults(db);
  const n = (db.prepare("SELECT COUNT(*) AS n FROM bonus_items").get() as { n: number }).n;
  expect(n).toBe(3);
});

test("task_bonus unique index exists", () => {
  const db = createDb(":memory:");
  const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_task_bonus'").get() as { name: string } | undefined;
  expect(idx?.name).toBe("idx_task_bonus");
});
```

- [ ] **Step 5: 运行测试 → 通过；全量测试**

Run: `npm test -- tests/scoring-schema.test.ts` → 先 FAIL（表/种子缺），完成 Step1-3 后 PASS。
Run: `npm test` → 全绿（既有用例不受影响）。

- [ ] **Step 6: 提交**

```bash
git add lib/schema.sql lib/db.ts lib/types.ts tests/scoring-schema.test.ts
git commit -m "feat: add bonus_items/task_bonus/scoring_settings tables + seed defaults"
```

---

### Task 2: 加分项仓储

**Files:**
- Create: `lib/repositories/bonusItems.ts`
- Test: `tests/bonus-items.test.ts`

**Interfaces:**
- Consumes: `createDb`、`BonusItem`。
- Produces:
  - `listBonusItems(db): BonusItem[]`（仅 active=1，ORDER BY sort_order, id）
  - `listAllBonusItems(db): BonusItem[]`（含归档，ORDER BY active DESC, sort_order, id）
  - `createBonusItem(db, {name, description?, points, sortOrder?}): BonusItem`
  - `updateBonusItem(db, id, {name, description, points, sortOrder}): BonusItem`
  - `archiveBonusItem(db, id): void`（active=0）、`restoreBonusItem(db, id): void`（active=1）
  - `getBonusItem(db, id): BonusItem | undefined`

- [ ] **Step 1: 写失败测试**

`tests/bonus-items.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import {
  listBonusItems, listAllBonusItems, createBonusItem,
  updateBonusItem, archiveBonusItem, restoreBonusItem,
} from "@/lib/repositories/bonusItems";

test("list returns seeded active items ordered", () => {
  const db = createDb(":memory:");
  const names = listBonusItems(db).map((b) => b.name);
  expect(names).toEqual(["专注完成", "用上支架", "做了检查"]);
});

test("create, update, archive/restore", () => {
  const db = createDb(":memory:");
  const b = createBonusItem(db, { name: "字迹工整", description: "字写得整齐", points: 4, sortOrder: 9 });
  expect(b.id).toBeGreaterThan(0);
  expect(b.points).toBe(4);

  const u = updateBonusItem(db, b.id, { name: "字迹工整", description: "写得整齐好看", points: 6, sortOrder: 9 });
  expect(u.points).toBe(6);
  expect(u.description).toBe("写得整齐好看");

  archiveBonusItem(db, b.id);
  expect(listBonusItems(db).some((x) => x.id === b.id)).toBe(false);
  expect(listAllBonusItems(db).some((x) => x.id === b.id)).toBe(true);
  restoreBonusItem(db, b.id);
  expect(listBonusItems(db).some((x) => x.id === b.id)).toBe(true);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/bonus-items.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`lib/repositories/bonusItems.ts`:
```ts
import type Database from "better-sqlite3";
import type { BonusItem } from "@/lib/types";

interface Row {
  id: number;
  name: string;
  description: string;
  points: number;
  active: number;
  sort_order: number;
}

function toItem(r: Row): BonusItem {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    points: r.points,
    active: r.active,
    sortOrder: r.sort_order,
  };
}

export function getBonusItem(db: Database.Database, id: number): BonusItem | undefined {
  const r = db.prepare("SELECT * FROM bonus_items WHERE id = ?").get(id) as Row | undefined;
  return r ? toItem(r) : undefined;
}

export function listBonusItems(db: Database.Database): BonusItem[] {
  const rows = db
    .prepare("SELECT * FROM bonus_items WHERE active = 1 ORDER BY sort_order, id")
    .all() as Row[];
  return rows.map(toItem);
}

export function listAllBonusItems(db: Database.Database): BonusItem[] {
  const rows = db
    .prepare("SELECT * FROM bonus_items ORDER BY active DESC, sort_order, id")
    .all() as Row[];
  return rows.map(toItem);
}

export function createBonusItem(
  db: Database.Database,
  input: { name: string; description?: string; points: number; sortOrder?: number },
): BonusItem {
  const info = db
    .prepare(
      "INSERT INTO bonus_items (name, description, points, active, sort_order) VALUES (?, ?, ?, 1, ?)",
    )
    .run(input.name, input.description ?? "", input.points, input.sortOrder ?? 0);
  return getBonusItem(db, Number(info.lastInsertRowid))!;
}

export function updateBonusItem(
  db: Database.Database,
  id: number,
  input: { name: string; description: string; points: number; sortOrder: number },
): BonusItem {
  db.prepare(
    "UPDATE bonus_items SET name = ?, description = ?, points = ?, sort_order = ? WHERE id = ?",
  ).run(input.name, input.description, input.points, input.sortOrder, id);
  return getBonusItem(db, id)!;
}

export function archiveBonusItem(db: Database.Database, id: number): void {
  db.prepare("UPDATE bonus_items SET active = 0 WHERE id = ?").run(id);
}

export function restoreBonusItem(db: Database.Database, id: number): void {
  db.prepare("UPDATE bonus_items SET active = 1 WHERE id = ?").run(id);
}
```

- [ ] **Step 4: 运行测试，确认通过；全量测试**

Run: `npm test -- tests/bonus-items.test.ts` → PASS
Run: `npm test` → 全绿。

- [ ] **Step 5: 提交**

```bash
git add lib/repositories/bonusItems.ts tests/bonus-items.test.ts
git commit -m "feat: add bonus items repository"
```

---

### Task 3: 评分设置仓储

**Files:**
- Create: `lib/repositories/scoringSettings.ts`
- Test: `tests/scoring-settings.test.ts`

**Interfaces:**
- Consumes: `createDb`、`ScoringSettings`。
- Produces:
  - `getScoringSettings(db): ScoringSettings`（读 id=1 行）
  - `updateScoringSettings(db, {onTimeBonus, errorPenalty, minPoints}): ScoringSettings`

- [ ] **Step 1: 写失败测试**

`tests/scoring-settings.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { getScoringSettings, updateScoringSettings } from "@/lib/repositories/scoringSettings";

test("get returns seeded defaults", () => {
  const db = createDb(":memory:");
  expect(getScoringSettings(db)).toEqual({ onTimeBonus: 3, errorPenalty: 2, minPoints: 1 });
});

test("update changes settings", () => {
  const db = createDb(":memory:");
  const s = updateScoringSettings(db, { onTimeBonus: 5, errorPenalty: 1, minPoints: 2 });
  expect(s).toEqual({ onTimeBonus: 5, errorPenalty: 1, minPoints: 2 });
  expect(getScoringSettings(db)).toEqual({ onTimeBonus: 5, errorPenalty: 1, minPoints: 2 });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/scoring-settings.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/repositories/scoringSettings.ts`:
```ts
import type Database from "better-sqlite3";
import type { ScoringSettings } from "@/lib/types";

export function getScoringSettings(db: Database.Database): ScoringSettings {
  const r = db
    .prepare("SELECT on_time_bonus, error_penalty, min_points FROM scoring_settings WHERE id = 1")
    .get() as { on_time_bonus: number; error_penalty: number; min_points: number };
  return {
    onTimeBonus: r.on_time_bonus,
    errorPenalty: r.error_penalty,
    minPoints: r.min_points,
  };
}

export function updateScoringSettings(
  db: Database.Database,
  input: { onTimeBonus: number; errorPenalty: number; minPoints: number },
): ScoringSettings {
  db.prepare(
    "UPDATE scoring_settings SET on_time_bonus = ?, error_penalty = ?, min_points = ? WHERE id = 1",
  ).run(input.onTimeBonus, input.errorPenalty, input.minPoints);
  return getScoringSettings(db);
}
```

- [ ] **Step 4: 运行测试，确认通过；全量测试**

Run: `npm test -- tests/scoring-settings.test.ts` → PASS
Run: `npm test` → 全绿。

- [ ] **Step 5: 提交**

```bash
git add lib/repositories/scoringSettings.ts tests/scoring-settings.test.ts
git commit -m "feat: add scoring settings repository"
```

---

### Task 4: computePoints 重写

**Files:**
- Modify: `lib/scoring.ts`
- Test: `tests/scoring.test.ts`

**Interfaces:**
- Consumes: 无（纯函数）。
- Produces: `computePoints(input: { basePoints; bonusPoints; onTimeBonus; errorCount; errorPenalty; minPoints }): number` = `max(minPoints, basePoints + bonusPoints + onTimeBonus - errorCount*errorPenalty)`。旧常量与旧签名删除。

- [ ] **Step 1: 重写测试**

将 `tests/scoring.test.ts` 整体替换为：
```ts
import { expect, test } from "vitest";
import { computePoints } from "@/lib/scoring";

test("base only", () => {
  expect(computePoints({ basePoints: 10, bonusPoints: 0, onTimeBonus: 0, errorCount: 0, errorPenalty: 2, minPoints: 1 })).toBe(10);
});

test("adds bonus points and on-time bonus", () => {
  expect(computePoints({ basePoints: 10, bonusPoints: 10, onTimeBonus: 3, errorCount: 0, errorPenalty: 2, minPoints: 1 })).toBe(23);
});

test("subtracts error penalty", () => {
  expect(computePoints({ basePoints: 10, bonusPoints: 0, onTimeBonus: 0, errorCount: 3, errorPenalty: 2, minPoints: 1 })).toBe(4);
});

test("floors at minPoints", () => {
  expect(computePoints({ basePoints: 2, bonusPoints: 0, onTimeBonus: 0, errorCount: 10, errorPenalty: 2, minPoints: 1 })).toBe(1);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/scoring.test.ts`
Expected: FAIL（旧签名 / 常量不匹配）

- [ ] **Step 3: 重写实现**

将 `lib/scoring.ts` 整体替换为：
```ts
export function computePoints(input: {
  basePoints: number;
  bonusPoints: number;
  onTimeBonus: number;
  errorCount: number;
  errorPenalty: number;
  minPoints: number;
}): number {
  const points =
    input.basePoints +
    input.bonusPoints +
    input.onTimeBonus -
    input.errorCount * input.errorPenalty;
  return Math.max(input.minPoints, points);
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/scoring.test.ts` → PASS
（注：此时 `lib/repositories/tasks.ts` 仍用旧 computePoints 调用，全量 `npm test` 可能未绿——Task 5 修复。可先只跑本文件。）

- [ ] **Step 5: 提交**

```bash
git add lib/scoring.ts tests/scoring.test.ts
git commit -m "feat: rewrite computePoints for configurable scoring"
```

---

### Task 5: scoreTask 重写 + listTaskBonus

**Files:**
- Modify: `lib/repositories/tasks.ts`
- Test: `tests/tasks.test.ts`

**Interfaces:**
- Consumes: `getTemplate`、`computePoints`(新签名)、`addPointEntry`、`getScoringSettings`；`bonus_items`/`task_bonus` 表。
- Produces:
  - `scoreTask(db, taskId, result: { actualMinutes: number; bonusItemIds: number[]; errorCount: number; note?: string; now?: string }): TaskInstance`
  - `listTaskBonus(db, taskId): number[]`（该任务选中的 bonus_item_id，升序）

- [ ] **Step 1: 重写 tasks 评分测试**

在 `tests/tasks.test.ts` 中：
1. 确保引入 `computePoints` 的测试不在此文件（computePoints 测试在 scoring.test.ts）。
2. 顶部按需引入：`import { getScoringSettings } from "@/lib/repositories/scoringSettings";` 和 `import { listBonusItems } from "@/lib/repositories/bonusItems";`（若测试用到）。
3. 删除旧的基于 `focused/usedScaffold/didCheck` 的 "scoring writes points..."、"re-scoring updates..."、"scoreTask records scored_at..." 三个测试，替换为下列新模型测试（沿用文件既有 `setup()`，它返回 `{ db, child, tpl }`，其中 tpl 基础分 10、默认时长 5）：
```ts
import { getBalance, listEntries } from "@/lib/repositories/points";
import { listBonusItems } from "@/lib/repositories/bonusItems";

test("scores with base + selected bonus + on-time; writes points and task_bonus", () => {
  const { db, child, tpl } = setup();
  const items = listBonusItems(db); // 3 seeded, each +5
  const t = assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-07-01" });
  // actualMinutes 5 <= defaultMinutes 5 → on-time (+3); pick first bonus (+5); base 10 = 18
  const scored = scoreTask(db, t.id, { actualMinutes: 5, bonusItemIds: [items[0].id], errorCount: 0 });
  expect(scored.status).toBe("scored");
  expect(scored.pointsAwarded).toBe(18);
  expect(getBalance(db, child.id)).toBe(18);
  expect(listTaskBonus(db, t.id)).toEqual([items[0].id]);
});

test("no on-time bonus when over time; errors subtract", () => {
  const { db, child, tpl } = setup();
  const t = assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-07-01" });
  // actualMinutes 9 > 5 → no on-time; no bonus; 2 errors * 2 = -4; base 10 → 6
  const scored = scoreTask(db, t.id, { actualMinutes: 9, bonusItemIds: [], errorCount: 2 });
  expect(scored.pointsAwarded).toBe(6);
});

test("re-scoring updates points and task_bonus without adding a new entry; scored_at preserved", () => {
  const { db, child, tpl } = setup();
  const items = listBonusItems(db);
  const t = assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-07-01" });
  scoreTask(db, t.id, { actualMinutes: 9, bonusItemIds: [], errorCount: 0, now: "2026-07-01T09:00:00.000Z" }); // base 10
  expect(getBalance(db, child.id)).toBe(10);
  const before = listEntries(db, child.id).length;
  const again = scoreTask(db, t.id, { actualMinutes: 5, bonusItemIds: [items[0].id, items[1].id], errorCount: 0, now: "2026-07-01T10:00:00.000Z" });
  // on-time (+3) + two bonuses (+10) + base 10 = 23
  expect(again.pointsAwarded).toBe(23);
  expect(again.scoredAt).toBe("2026-07-01T09:00:00.000Z"); // preserved
  expect(getBalance(db, child.id)).toBe(23);
  expect(listEntries(db, child.id).length).toBe(before); // no new entry
  expect(listTaskBonus(db, t.id).sort()).toEqual([items[0].id, items[1].id].sort());
});
```
（"assign then list" 及 "cannot..."/其它非评分测试保留不动。`listTaskBonus`、`scoreTask` 从 tasks 仓储引入——文件已 import scoreTask/assignTask，补 `listTaskBonus`。）

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/tasks.test.ts`
Expected: FAIL（scoreTask 旧签名 / listTaskBonus 未定义）

- [ ] **Step 3: 重写 scoreTask + 加 listTaskBonus**

在 `lib/repositories/tasks.ts`：
1. 顶部 import 补：`import { getScoringSettings } from "@/lib/repositories/scoringSettings";`
2. 将 `scoreTask` 整个函数替换为：
```ts
export function scoreTask(
  db: Database.Database,
  taskId: number,
  result: {
    actualMinutes: number;
    bonusItemIds: number[];
    errorCount: number;
    note?: string;
    now?: string;
  },
): TaskInstance {
  const task = getTask(db, taskId);
  if (!task) throw new Error("任务不存在");
  const tpl = getTemplate(db, task.templateId);
  if (!tpl) throw new Error("任务模板不存在");

  const settings = getScoringSettings(db);
  const onTimeBonus = result.actualMinutes <= tpl.defaultMinutes ? settings.onTimeBonus : 0;

  let bonusPoints = 0;
  if (result.bonusItemIds.length > 0) {
    const placeholders = result.bonusItemIds.map(() => "?").join(",");
    const row = db
      .prepare(`SELECT COALESCE(SUM(points), 0) AS s FROM bonus_items WHERE id IN (${placeholders})`)
      .get(...result.bonusItemIds) as { s: number };
    bonusPoints = row.s;
  }

  const points = computePoints({
    basePoints: tpl.basePoints,
    bonusPoints,
    onTimeBonus,
    errorCount: result.errorCount,
    errorPenalty: settings.errorPenalty,
    minPoints: settings.minPoints,
  });
  const wasScored = task.status === "scored";
  const reason = `完成任务: ${tpl.name}`;
  const now = result.now ?? new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE task_instances SET status='scored', actual_minutes=?, error_count=?, note=?, points_awarded=?, scored_at=COALESCE(scored_at, ?) WHERE id=?`,
    ).run(result.actualMinutes, result.errorCount, result.note ?? null, points, now, taskId);

    db.prepare("DELETE FROM task_bonus WHERE task_instance_id = ?").run(taskId);
    const ins = db.prepare("INSERT INTO task_bonus (task_instance_id, bonus_item_id) VALUES (?, ?)");
    for (const bid of result.bonusItemIds) ins.run(taskId, bid);

    if (wasScored) {
      db.prepare("UPDATE point_entries SET delta = ?, reason = ? WHERE task_instance_id = ?").run(points, reason, taskId);
    } else {
      addPointEntry(db, { childId: task.childId, delta: points, reason, taskInstanceId: taskId, now });
    }
  });
  tx();
  return getTask(db, taskId)!;
}
```
3. 在文件内新增：
```ts
export function listTaskBonus(db: Database.Database, taskId: number): number[] {
  const rows = db
    .prepare("SELECT bonus_item_id AS bid FROM task_bonus WHERE task_instance_id = ? ORDER BY bonus_item_id")
    .all(taskId) as { bid: number }[];
  return rows.map((r) => r.bid);
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/tasks.test.ts` → PASS

- [ ] **Step 5: 全量测试（预期 score 路由测试可能红）**

Run: `npm test`
Expected: 除 score API 路由相关（仍用旧入参）外全绿；若既有 `tests/` 有对 score 路由传 focused 的用例，Task 6 修复。若本步除 score 路由外还有其它红，需回看。

- [ ] **Step 6: 提交**

```bash
git add lib/repositories/tasks.ts tests/tasks.test.ts
git commit -m "feat: rewrite scoreTask for configurable bonuses + on-time + listTaskBonus"
```

---

### Task 6: score API 入参切换

**Files:**
- Modify: `app/api/tasks/[id]/score/route.ts`
- Test: `tests/api-score.test.ts`

**Interfaces:**
- Consumes: `scoreTask`(新签名)、`getDb`。
- Produces: `POST /api/tasks/[id]/score` 入参 `{ actualMinutes, bonusItemIds, errorCount, note }`，错误 400。

- [ ] **Step 1: 改路由**

将 `app/api/tasks/[id]/score/route.ts` 的 POST 改为：
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
      bonusItemIds: Array.isArray(body.bonusItemIds) ? body.bonusItemIds.map(Number) : [],
      errorCount: Number(body.errorCount ?? 0),
      note: body.note,
    });
    return NextResponse.json(task);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 2: 集成测试**

`tests/api-score.test.ts`:
```ts
import { expect, test } from "vitest";

process.env.DB_PATH = ":memory:";

test("score route computes points from bonusItemIds + on-time", async () => {
  const { POST: createChild } = await import("@/app/api/children/route");
  const child = await (await createChild(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "小明", grade: 1 }) }))).json();
  const { POST: createTpl } = await import("@/app/api/templates/route");
  const tpl = await (await createTpl(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 }) }))).json();
  const { POST: assign } = await import("@/app/api/tasks/route");
  const task = await (await assign(new Request("http://x", { method: "POST", body: JSON.stringify({ childId: child.id, templateId: tpl.id, date: "2026-07-01" }) }))).json();

  const { GET: listBonus } = await import("@/app/api/bonus-items/route").catch(() => ({ GET: null as never }));
  // bonus-items API 在 Plan 2 才有；此处直接用一个已知 seeded id 是不稳妥的，改为不选加分项，仅验证 base + on-time
  const { POST: score } = await import("@/app/api/tasks/[id]/score/route");
  const scored = await (await score(
    new Request("http://x", { method: "POST", body: JSON.stringify({ actualMinutes: 5, bonusItemIds: [], errorCount: 0 }) }),
    { params: Promise.resolve({ id: String(task.id) }) },
  )).json();
  // base 10 + on-time 3 = 13
  expect(scored.pointsAwarded).toBe(13);
  expect(scored.status).toBe("scored");
});
```
（说明：加分项 id 需从 DB 读，Plan 2 才有 bonus-items API；本测试只验证 base+on-time 路径与入参切换，不选加分项，避免依赖未建的 API。删除上面 `listBonus` 那行无用引入——直接用空 bonusItemIds。）

将上面测试中的 `listBonus` 两行删去，最终 body 用 `bonusItemIds: []`。

- [ ] **Step 3: 运行测试 + build + 全量**

Run: `npm test -- tests/api-score.test.ts` → PASS
Run: `npx next build` → 编译通过。
Run: `npm test` → **全绿**（本 plan 完成，构建与测试均通过）。

- [ ] **Step 4: 提交**

```bash
git add app/api/tasks/[id]/score/route.ts tests/api-score.test.ts
git commit -m "feat: switch score API to bonusItemIds input"
```

---

## Self-Review

**Spec coverage（对照 2026-07-01-configurable-scoring-design.md §2-§5 的数据/引擎部分）：**
- 三表 + 迁移种子（bonus_items/task_bonus+索引/scoring_settings，默认三项+设置）→ Task 1 ✓
- 加分项仓储 CRUD/归档 → Task 2 ✓
- 评分设置 get/update → Task 3 ✓
- computePoints 新模型（base+bonus+onTime−error*penalty，floor min）→ Task 4 ✓
- scoreTask 重写（按时判定、加分项汇总、task_bonus 先删后插、scored_at 保留、upsert 流水、不再写旧列）+ listTaskBonus → Task 5 ✓
- score API 入参切换 `{actualMinutes,bonusItemIds,errorCount,note}` → Task 6 ✓
- 管理 UI（加分项/评分设置）→ Plan 2；表单动态化/说明/展示 → Plan 3。

**Placeholder scan：** 无 TBD/TODO；每步含完整代码与命令。Task 6 测试内已明确删掉未用引入、用空 bonusItemIds 避免依赖 Plan 2 的 API。

**Type consistency：** `BonusItem`/`ScoringSettings`（Task 1）被 Task 2/3 仓储返回、Task 5 汇总消费一致；`computePoints` 新签名（Task 4）与 Task 5 调用字段一致；`scoreTask` 新入参（Task 5）与 Task 6 路由构造一致；`getScoringSettings`/`listBonusItems`/`listTaskBonus` 名称跨任务一致。

**注：** `lib/db.ts`、`lib/repositories/tasks.ts`、`tests/tasks.test.ts` 已多次演进，实现者须读实际文件，按"同语义位置"改（createDb 内接线、scoreTask 整函数替换、tasks 测试中定位并替换三个旧评分测试、保留其它），不要整体覆盖未指明部分。计分模型改变后，旧的 focused/usedScaffold/didCheck 列不再写入但保留。