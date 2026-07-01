# 可配置评分：评分表单动态化 + 说明 + 展示 实现计划 — Plan 3/3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 评分表单按启用的加分项动态渲染（含说明）、勾选并提交；记录页展示任务获得的加分项。

**Architecture:** `listTasks`/`getTask` 附带每个任务已选的 `bonusItemIds`（读 task_bonus）。ScoreForm 拉取启用加分项动态渲染勾选框（显示说明），提交 `bonusItemIds`；已评分任务回填其已选项。记录页用加分项名映射展示每个已评分任务获得的加分项。

**Tech Stack:** Next.js 15 App Router, TypeScript, better-sqlite3, Vitest, Tailwind v3。

## Global Constraints

- 不引入新依赖；better-sqlite3 同步 API；仓储函数首参 `db`。
- ScoreForm 只渲染**启用**加分项（`GET /api/bonus-items`，active）；每项显示 `description`；提交 `{ actualMinutes, bonusItemIds, errorCount, note }`（Plan 1 已把 score API 切到该入参）。
- 已评分任务回填：其已选 `bonusItemIds` 来自任务对象（Task 1 让任务读带上），勾选框预选。
- 移除旧的 专注完成/用上支架/做了检查 固定勾选框。
- 既有 54 项测试保持通过；UI 以 `npx next build` 通过 + 浏览器截图验证；本 plan 结束后功能端到端可用。

---

## File Structure

- `lib/types.ts` — 修改：`TaskInstance` 加 `bonusItemIds: number[]`。
- `lib/repositories/tasks.ts` — 修改：`getTask` 附带 `bonusItemIds`（经 `listTaskBonus`）；`listTasks` 每行附带。
- `app/_components/ScoreForm.tsx` — 修改：动态加分项勾选（含说明）+ 提交 bonusItemIds；`initial` 形状改为 `{actualMinutes, errorCount, note, bonusItemIds}`。
- `app/page.tsx` — 修改：`initialFor(t)` 产出新形状（用 `t.bonusItemIds`）；移除对 focused/usedScaffold/didCheck 的使用。
- `app/records/page.tsx` — 修改：拉取加分项名映射；按天回看每个已评分任务展示获得的加分项。

---

### Task 1: 任务读附带 bonusItemIds

**Files:**
- Modify: `lib/types.ts`, `lib/repositories/tasks.ts`
- Test: `tests/task-bonus-ids.test.ts`

**Interfaces:**
- Consumes: 既有 `getTask`(内部)、`toTask`、`listTaskBonus`(Plan 1)、`listTasks`、`assignTask`、`scoreTask`。
- Produces: `TaskInstance` 含 `bonusItemIds: number[]`；`getTask` 与 `listTasks` 返回的任务都填充该字段（未评分/无选项为 `[]`）。

- [ ] **Step 1: 类型加字段**

在 `lib/types.ts` 的 `TaskInstance` 接口加：
```ts
  bonusItemIds: number[];
```

- [ ] **Step 2: 写失败测试**

`tests/task-bonus-ids.test.ts`:
```ts
import { expect, test } from "vitest";
import { createDb } from "@/lib/db";
import { createChild } from "@/lib/repositories/children";
import { createTemplate } from "@/lib/repositories/templates";
import { listBonusItems } from "@/lib/repositories/bonusItems";
import { assignTask, listTasks, scoreTask } from "@/lib/repositories/tasks";

test("listTasks attaches bonusItemIds (empty when unscored, populated after scoring)", () => {
  const db = createDb(":memory:");
  const c = createChild(db, { name: "小明", grade: 1 });
  const tpl = createTemplate(db, { name: "写字", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  const items = listBonusItems(db);
  const t = assignTask(db, { childId: c.id, templateId: tpl.id, date: "2026-07-01" });

  expect(listTasks(db, c.id, "2026-07-01")[0].bonusItemIds).toEqual([]);

  scoreTask(db, t.id, { actualMinutes: 5, bonusItemIds: [items[0].id, items[1].id], errorCount: 0 });
  const scored = listTasks(db, c.id, "2026-07-01")[0];
  expect(scored.bonusItemIds.slice().sort()).toEqual([items[0].id, items[1].id].slice().sort());
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npm test -- tests/task-bonus-ids.test.ts`
Expected: FAIL（`bonusItemIds` 缺失 / 类型报错）

- [ ] **Step 4: 实现——getTask/listTasks 填充 bonusItemIds**

在 `lib/repositories/tasks.ts`：
- 找到内部 `getTask(db, id)`（返回 `TaskInstance | undefined`）。把它改为在返回前附加 `bonusItemIds`。示例（保持原查询与 `toTask` 不变，仅在构造返回值处补字段）：
```ts
function getTask(db: Database.Database, id: number): TaskInstance | undefined {
  const r = db.prepare("SELECT * FROM task_instances WHERE id = ?").get(id) as Row | undefined;
  if (!r) return undefined;
  const task = toTask(r);
  task.bonusItemIds = listTaskBonus(db, id);
  return task;
}
```
  （若现有 `getTask` 写法不同，按同语义在"由 Row 得到 TaskInstance 后、返回前"补 `task.bonusItemIds = listTaskBonus(db, id)`。）
- 找到 `listTasks(db, childId, date)`：在 `rows.map(toTask)` 之后为每个任务补 `bonusItemIds`。示例：
```ts
export function listTasks(db: Database.Database, childId: number, date: string): TaskInstance[] {
  const rows = db
    .prepare("SELECT * FROM task_instances WHERE child_id = ? AND date = ? ORDER BY id")
    .all(childId, date) as Row[];
  return rows.map((r) => {
    const task = toTask(r);
    task.bonusItemIds = listTaskBonus(db, task.id);
    return task;
  });
}
```
  （`toTask` 本身可让 `bonusItemIds` 默认 `[]`，或不设、由上面赋值填充；确保类型满足 `number[]`。若 `toTask` 需要满足类型，在其返回对象里加 `bonusItemIds: []`，再由 getTask/listTasks 覆盖。）

- [ ] **Step 5: 运行测试，确认通过；全量**

Run: `npm test -- tests/task-bonus-ids.test.ts` → PASS
Run: `npm test` → 全绿（既有任务测试新增字段不影响其针对具体字段的断言）。

- [ ] **Step 6: 提交**

```bash
git add lib/types.ts lib/repositories/tasks.ts tests/task-bonus-ids.test.ts
git commit -m "feat: attach bonusItemIds to task reads"
```

---

### Task 2: ScoreForm 动态加分项 + 今日页回填

**Files:**
- Modify: `app/_components/ScoreForm.tsx`, `app/page.tsx`
- 验证：`npx next build` + 截图

**Interfaces:**
- Consumes: `GET /api/bonus-items`（active 加分项，字段 id/name/description/points）；`POST /api/tasks/[id]/score`（入参 `{actualMinutes,bonusItemIds,errorCount,note}`）；任务对象的 `bonusItemIds`（Task 1）。
- Produces: `ScoreForm` 的 `initial` 形状 `{ actualMinutes: number; errorCount: number; note: string; bonusItemIds: number[] }`。

- [ ] **Step 1: 重写 ScoreForm**

将 `app/_components/ScoreForm.tsx` 整体替换为：
```tsx
"use client";
import { useEffect, useState } from "react";

interface BonusItem { id: number; name: string; description: string; points: number }

export function ScoreForm({
  taskId,
  onDone,
  initial,
}: {
  taskId: number;
  onDone: () => void;
  initial?: { actualMinutes: number; errorCount: number; note: string; bonusItemIds: number[] };
}) {
  const [items, setItems] = useState<BonusItem[]>([]);
  const [selected, setSelected] = useState<number[]>(initial?.bonusItemIds ?? []);
  const [actualMinutes, setMinutes] = useState(initial?.actualMinutes ?? 5);
  const [errorCount, setErrors] = useState(initial?.errorCount ?? 0);
  const [note, setNote] = useState(initial?.note ?? "");

  useEffect(() => {
    fetch("/api/bonus-items").then((r) => r.json()).then(setItems);
  }, []);

  function toggleItem(id: number, on: boolean) {
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  }

  async function submit() {
    const res = await fetch(`/api/tasks/${taskId}/score`, {
      method: "POST",
      body: JSON.stringify({ actualMinutes, bonusItemIds: selected, errorCount, note }),
    });
    if (!res.ok) {
      alert((await res.json()).error);
      return;
    }
    onDone();
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-100">
      <label className="block">用时(分钟)
        <input type="number" value={actualMinutes} onChange={(e) => setMinutes(+e.target.value)} className="input ml-2 w-16" />
      </label>
      <div className="space-y-1">
        {items.map((it) => (
          <label key={it.id} className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={selected.includes(it.id)} onChange={(e) => toggleItem(it.id, e.target.checked)} />
            <span>
              <span className="font-medium">{it.name} <span className="text-amber-600">+{it.points}</span></span>
              {it.description && <span className="block text-xs text-slate-500">{it.description}</span>}
            </span>
          </label>
        ))}
      </div>
      <label className="block">错题数
        <input type="number" value={errorCount} onChange={(e) => setErrors(+e.target.value)} className="input ml-2 w-16" />
      </label>
      <input placeholder="备注" value={note} onChange={(e) => setNote(e.target.value)} className="input w-full" />
      <button onClick={submit} className="btn btn-emerald">保存评分</button>
    </div>
  );
}
```

- [ ] **Step 2: 今日页 initialFor + Task 接口**

在 `app/page.tsx`：
- `Task` 接口补 `bonusItemIds: number[]`（若尚无）。旧的 focused/usedScaffold/didCheck 字段不再使用，可保留或删除（保留无害）。
- 将 `initialFor` 改为新形状：
```tsx
const initialFor = (t: Task) => ({
  actualMinutes: t.actualMinutes ?? 5,
  errorCount: t.errorCount ?? 0,
  note: t.note ?? "",
  bonusItemIds: t.bonusItemIds ?? [],
});
```
- ScoreForm 渲染那行保持不变（已评分传 `initialFor(t)`，否则 `undefined`）：
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

Run: `npm run dev`；今日页把一个任务走到 done，点「评分」
Expected: 评分表单显示动态加分项（专注完成/用上支架/做了检查，各含说明与 +分值），可勾选；保存后得分含勾选项与按时加分；对已评分任务点「查看/修改」时，之前勾选的加分项已回填。

- [ ] **Step 5: 提交**

```bash
git add app/_components/ScoreForm.tsx app/page.tsx
git commit -m "feat: dynamic bonus-item checkboxes in score form + prefill"
```

---

### Task 3: 记录页展示获得的加分项

**Files:**
- Modify: `app/records/page.tsx`
- 验证：`npx next build` + 截图

**Interfaces:**
- Consumes: `GET /api/bonus-items?all=1`（id→name 映射，含归档以便历史名可显示）；任务对象的 `bonusItemIds`（Task 1）。
- Produces: 无。

- [ ] **Step 1: 拉取加分项名映射 + Task 接口**

在 `app/records/page.tsx`：
- `Task` 接口补 `bonusItemIds: number[]`。
- 新增状态与加载：
```tsx
const [bonusNames, setBonusNames] = useState<Record<number, string>>({});
```
在初始 `useEffect`（拉 children/templates 处）追加：
```tsx
    fetch("/api/bonus-items?all=1").then((r) => r.json()).then((items: { id: number; name: string }[]) => {
      const map: Record<number, string> = {};
      items.forEach((it) => { map[it.id] = it.name; });
      setBonusNames(map);
    });
```

- [ ] **Step 2: 按天回看展示获得的加分项**

在「按天回看任务」每个任务 `<li>` 的时间戳行之后，追加一行展示获得的加分项（仅当有）：
```tsx
              {t.bonusItemIds.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {t.bonusItemIds.map((bid) => (
                    <span key={bid} className="chip bg-violet-100 text-violet-700">{bonusNames[bid] ?? "加分项"}</span>
                  ))}
                </div>
              )}
```
（放在既有"开始/完成/评分"时间戳 `<div>` 之后、`<li>` 结束之前。）

- [ ] **Step 3: build + 全量测试**

Run: `npx next build` → 编译通过。
Run: `npm test` → 全绿。

- [ ] **Step 4: 浏览器验证**

Run: `npm run dev`，打开 `/records`，选有已评分任务的日期
Expected: 已评分且有加分项的任务下显示加分项名（紫色 chip）；无加分项的任务不显示该行。

- [ ] **Step 5: 提交**

```bash
git add app/records/page.tsx
git commit -m "feat: show earned bonus items in records"
```

---

## Self-Review

**Spec coverage（对照 2026-07-01-configurable-scoring-design.md §6 界面部分 + 原始需求「评分明细加说明」）：**
- 评分表单动态渲染启用加分项 + 每项说明 + 提交 bonusItemIds → Task 2 ✓
- 已评分任务回填已选加分项 → Task 1（任务读带 bonusItemIds）+ Task 2（预选）✓
- 移除旧固定三勾选框 → Task 2 ✓
- 记录页展示获得的加分项 → Task 3 ✓
- 「评分明细加说明」（原始需求①）→ Task 2 表单每项显示 description ✓
- 数据/引擎 → Plan 1；管理 UI/设置 → Plan 2（均已完成）。

**Placeholder scan：** 无 TBD/TODO；每步含完整代码与命令。

**Type consistency：** `TaskInstance.bonusItemIds: number[]`（Task 1）被今日页 `initialFor`（Task 2）与记录页（Task 3）消费；`ScoreForm.initial` 新形状 `{actualMinutes,errorCount,note,bonusItemIds}`（Task 2）与今日页 `initialFor` 产出一致；提交体 `{actualMinutes,bonusItemIds,errorCount,note}` 与 Plan 1 的 score API 入参一致；`GET /api/bonus-items`（active）与 `?all=1`（名映射）均为 Plan 2 已建端点。

**注：** `lib/repositories/tasks.ts`、`app/page.tsx`、`app/records/page.tsx` 已多次演进，实现者须读实际文件按"同语义位置"改（getTask/listTasks 返回前补 bonusItemIds、initialFor、records li 时间戳行后追加）。ScoreForm 为整体替换（其结构已知）。`toTask` 若需满足 `bonusItemIds` 必填类型，可在其返回加 `bonusItemIds: []` 占位，再由 getTask/listTasks 覆盖。