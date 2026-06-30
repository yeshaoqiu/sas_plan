# 评分可查看/修改 + 历史弹窗 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让已评分任务可查看/原地改分，并把兑换历史与积分流水改为弹窗展示。

**Architecture:** `scoreTask` 改为 upsert（再评分时更新任务行 + 更新那条关联积分流水，不新增）。今日页已评分任务加「查看/修改」入口，`ScoreForm` 支持预填。新增 `Modal` 组件，`/records` 的兑换历史/积分流水改为按钮触发弹窗。

**Tech Stack:** Next.js 15 App Router, TypeScript, better-sqlite3, Vitest, Tailwind v3。

## Global Constraints

- 不引入新依赖；不改数据库 schema；better-sqlite3 同步 API；仓储函数首参 `db`。
- 再评分=原地更新：更新任务行 + `UPDATE point_entries ... WHERE task_instance_id = 任务id`，**不新增流水**；去掉「任务已评分」抛错；余额由流水求和派生自动校正。
- 评分写入的流水以 `task_instance_id` 关联且每任务一条；兑换流水用 `reward_id`，故 `WHERE task_instance_id=?` 精确命中评分流水。
- TDD（仓储改动）；UI 以 `npx next build` 通过 + 截图验证；既有测试相应更新后保持全绿。
- 沿用童趣主题共享类（`.btn`/`.btn-primary`/`.btn-sky`/`.btn-emerald`/`.card`/`.chip`/`.input`）。

---

## File Structure

- `lib/repositories/tasks.ts` — 修改：`scoreTask` 加再评分分支（首评 insert / 重评 update 同一流水）。
- `tests/tasks.test.ts` — 修改：把「不能重复评分」测试替换为「重评更新得分与余额、流水不新增」。
- `app/_components/ScoreForm.tsx` — 修改：加可选 `initial` 入参用于预填。
- `app/page.tsx` — 修改：Task 接口补结果字段；已评分行加「查看/修改」入口并传 `initial`。
- `app/_components/Modal.tsx` — 新建：轻量模态框。
- `app/records/page.tsx` — 修改：兑换历史/积分流水两区块改按钮 + 弹窗，按天回看保持内联。

---

### Task 1: scoreTask 再评分（原地更新）

**Files:**
- Modify: `lib/repositories/tasks.ts`
- Test: `tests/tasks.test.ts`

**Interfaces:**
- Consumes: `getTemplate`、`computePoints`、`addPointEntry`（均已有）；测试用 `createDb`/`createChild`/`createTemplate`/`assignTask` + `getBalance`/`listEntries`（来自 points）。
- Produces: `scoreTask(db, taskId, result)` 改为可重复调用；再评分时更新任务行与关联流水、不新增流水；返回更新后的 `TaskInstance`。签名不变。

- [ ] **Step 1: 改测试——把「不能重复评分」替换为「重评更新」**

打开 `tests/tasks.test.ts`：
1. 确保顶部从 points 仓储引入 `getBalance` 与 `listEntries`（若已引入 `getBalance` 则补 `listEntries`）：
```ts
import { getBalance, listEntries } from "@/lib/repositories/points";
```
2. 删除名为 `"cannot score twice"`（断言 `toThrow("任务已评分")`）的整个 test 块。
3. 新增以下测试（沿用文件里既有的 `setup()` 助手，它返回 `{ db, child, tpl }`）：
```ts
test("re-scoring updates points and balance without adding a new entry", () => {
  const { db, child, tpl } = setup();
  const t = assignTask(db, { childId: child.id, templateId: tpl.id, date: "2026-06-29" });

  // first score: base 10
  scoreTask(db, t.id, { actualMinutes: 5, focused: false, usedScaffold: false, didCheck: false, errorCount: 0 });
  expect(getBalance(db, child.id)).toBe(10);
  const entryCountBefore = listEntries(db, child.id).length;

  // re-score: base 10 + focus 5 = 15
  const updated = scoreTask(db, t.id, { actualMinutes: 6, focused: true, usedScaffold: false, didCheck: false, errorCount: 0 });
  expect(updated.status).toBe("scored");
  expect(updated.pointsAwarded).toBe(15);
  expect(getBalance(db, child.id)).toBe(15);
  expect(listEntries(db, child.id).length).toBe(entryCountBefore); // no new entry added
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/tasks.test.ts`
Expected: FAIL（重评抛「任务已评分」或断言不符）。

- [ ] **Step 3: 实现再评分分支**

在 `lib/repositories/tasks.ts` 中，将 `scoreTask` 整个函数替换为：
```ts
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
  const tpl = getTemplate(db, task.templateId);
  if (!tpl) throw new Error("任务模板不存在");

  const wasScored = task.status === "scored";
  const points = computePoints({
    basePoints: tpl.basePoints,
    focused: result.focused,
    usedScaffold: result.usedScaffold,
    didCheck: result.didCheck,
    errorCount: result.errorCount,
  });
  const reason = `完成任务: ${tpl.name}`;

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
    if (wasScored) {
      db.prepare(
        "UPDATE point_entries SET delta = ?, reason = ? WHERE task_instance_id = ?",
      ).run(points, reason, taskId);
    } else {
      addPointEntry(db, {
        childId: task.childId,
        delta: points,
        reason,
        taskInstanceId: taskId,
        now: result.now,
      });
    }
  });
  tx();
  return getTask(db, taskId)!;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/tasks.test.ts`
Expected: PASS（含 assign/list、首评写分、重评更新三测试）。

- [ ] **Step 5: 全量测试**

Run: `npm test`
Expected: 全绿（条数较前少 1 个旧测试、多 1 个新测试，净持平或+ -取决既有；总体通过）。

- [ ] **Step 6: 提交**

```bash
git add lib/repositories/tasks.ts tests/tasks.test.ts
git commit -m "feat: allow re-scoring a task (in-place points update)"
```

---

### Task 2: ScoreForm 预填 + 今日页查看/修改

**Files:**
- Modify: `app/_components/ScoreForm.tsx`
- Modify: `app/page.tsx`
- 验证：`npx next build` + 截图

**Interfaces:**
- Consumes: `POST /api/tasks/[id]/score`（现为 upsert）；`listTasks` 返回的任务结果字段（`actualMinutes`、`focused`、`usedScaffold`、`didCheck`、`errorCount`、`note`、`pointsAwarded`）。
- Produces：`ScoreForm` 新增可选 `initial` 入参。

- [ ] **Step 1: ScoreForm 加 initial 预填**

将 `app/_components/ScoreForm.tsx` 的组件签名与 state 初始化改为支持 `initial`（其余提交逻辑、JSX 不变）：
```tsx
"use client";
import { useState } from "react";

export function ScoreForm({
  taskId,
  onDone,
  initial,
}: {
  taskId: number;
  onDone: () => void;
  initial?: {
    actualMinutes: number;
    focused: boolean;
    usedScaffold: boolean;
    didCheck: boolean;
    errorCount: number;
    note: string;
  };
}) {
  const [actualMinutes, setMinutes] = useState(initial?.actualMinutes ?? 5);
  const [focused, setFocused] = useState(initial?.focused ?? false);
  const [usedScaffold, setScaffold] = useState(initial?.usedScaffold ?? false);
  const [didCheck, setCheck] = useState(initial?.didCheck ?? false);
  const [errorCount, setErrors] = useState(initial?.errorCount ?? 0);
  const [note, setNote] = useState(initial?.note ?? "");
  // ...rest of the component body (submit + JSX) stays exactly as-is...
```
注意：只改签名与 6 个 `useState` 初值；`submit()` 与返回的表单 JSX 保持原样不动。

- [ ] **Step 2: 今日页 Task 接口补字段 + initial 助手**

在 `app/page.tsx` 中：
1. 扩展本地 `Task` 接口，补上结果字段：
```tsx
interface Task {
  id: number;
  templateId: number;
  status: string;
  pointsAwarded: number | null;
  actualMinutes: number | null;
  focused: number | null;
  usedScaffold: number | null;
  didCheck: number | null;
  errorCount: number | null;
  note: string | null;
}
```
2. 在组件内（`tplSubject`/`tplName` 附近）加一个助手，把已存任务转成 ScoreForm 的 `initial`：
```tsx
const initialFor = (t: Task) => ({
  actualMinutes: t.actualMinutes ?? 5,
  focused: !!t.focused,
  usedScaffold: !!t.usedScaffold,
  didCheck: !!t.didCheck,
  errorCount: t.errorCount ?? 0,
  note: t.note ?? "",
});
```

- [ ] **Step 3: 已评分行加「查看/修改」入口并传 initial**

在今日任务列表项中，把"已评分显示 chip、否则显示评分按钮"的那段三元，改为已评分时同时显示 chip + 「查看/修改」按钮；并在 ScoreForm 渲染处按状态传 `initial`：
```tsx
{t.status === "scored" ? (
  <span className="flex items-center gap-2">
    <span className="chip bg-emerald-100 text-emerald-700">🎉 已评分 +{t.pointsAwarded}</span>
    <button onClick={() => setScoring(scoring === t.id ? null : t.id)} className="btn btn-sky px-3 py-1 text-sm">查看/修改</button>
  </span>
) : (
  <button onClick={() => setScoring(scoring === t.id ? null : t.id)} className="btn btn-primary px-3 py-1 text-sm">评分</button>
)}
```
并把 ScoreForm 渲染那行改为传入 initial（已评分回填，未评分用默认）：
```tsx
{scoring === t.id && (
  <ScoreForm
    taskId={t.id}
    initial={t.status === "scored" ? initialFor(t) : undefined}
    onDone={() => { setScoring(null); loadTasks(); }}
  />
)}
```

- [ ] **Step 4: build + 全量测试**

Run: `npx next build`
Expected: 编译通过。

Run: `npm test`
Expected: 全绿。

- [ ] **Step 5: 浏览器验证**

Run: `npm run dev`，打开 `/`，对一个已评分任务点「查看/修改」
Expected: 表单回填当时的用时/勾选/错题/备注；改动后保存，得分与进度条更新，且积分流水不新增（可在 /records 流水弹窗确认条数不变）。

- [ ] **Step 6: 提交**

```bash
git add app/_components/ScoreForm.tsx app/page.tsx
git commit -m "feat: view/edit existing task scores on today page"
```

---

### Task 3: Modal 组件 + /records 弹窗

**Files:**
- Create: `app/_components/Modal.tsx`
- Modify: `app/records/page.tsx`
- 验证：`npx next build` + 截图

**Interfaces:**
- Consumes: 现有 `redemptions`/`entries` 状态（已在 records 页按孩子加载）。
- Produces: `Modal({ open, title, onClose, children })` 组件。

- [ ] **Step 1: 新建 Modal 组件**

`app/_components/Modal.tsx`:
```tsx
"use client";
import type { ReactNode } from "react";

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full px-2 text-slate-500 hover:bg-slate-100">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: /records 兑换历史与积分流水改为按钮+弹窗**

在 `app/records/page.tsx`：
1. 顶部 import 加：
```tsx
import { Modal } from "../_components/Modal";
```
2. 组件内加两个开关状态（与现有 useState 一起）：
```tsx
const [showRedemptions, setShowRedemptions] = useState(false);
const [showLedger, setShowLedger] = useState(false);
```
3. 删除原「兑换历史」`<section>` 与「积分流水」`<section>` 两个内联区块，替换为两个按钮 + 两个 Modal（放在「按天回看任务」section 之后）：
```tsx
      <div className="flex gap-3">
        <button className="btn btn-sky px-3 py-1" onClick={() => setShowRedemptions(true)}>查看兑换历史</button>
        <button className="btn btn-primary px-3 py-1" onClick={() => setShowLedger(true)}>查看积分流水</button>
      </div>

      <Modal open={showRedemptions} title="兑换历史" onClose={() => setShowRedemptions(false)}>
        <ul className="space-y-2">
          {redemptions.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>{e.reason}</span>
              <span className="text-rose-500">{e.delta}⭐ · {fmt(e.createdAt)}</span>
            </li>
          ))}
          {redemptions.length === 0 && <li className="text-slate-500">还没有兑换记录。</li>}
        </ul>
      </Modal>

      <Modal open={showLedger} title="积分流水" onClose={() => setShowLedger(false)}>
        <ul className="space-y-1 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>{e.reason}</span>
              <span className={e.delta >= 0 ? "text-emerald-600" : "text-rose-500"}>
                {e.delta >= 0 ? `+${e.delta}` : e.delta}⭐ · {fmt(e.createdAt)}
              </span>
            </li>
          ))}
          {entries.length === 0 && <li className="text-slate-500">还没有积分记录。</li>}
        </ul>
      </Modal>
```
保持「按天回看任务」section 不变；`fmt`、`redemptions`、`entries`、对应的 `useEffect` 加载逻辑都保留。

- [ ] **Step 3: build + 全量测试**

Run: `npx next build`
Expected: 编译通过。

Run: `npm test`
Expected: 全绿。

- [ ] **Step 4: 浏览器验证**

Run: `npm run dev`，打开 `/records`
Expected: 「按天回看任务」内联显示；点「查看兑换历史」「查看积分流水」分别弹出模态框展示列表；点遮罩或 ✕ 关闭；切换孩子后再打开内容随之变化。

- [ ] **Step 5: 提交**

```bash
git add app/_components/Modal.tsx app/records/page.tsx
git commit -m "feat: show redemptions and ledger in modals on records page"
```

---

## Self-Review

**Spec coverage（对照 2026-06-30-edit-score-and-history-modals-design.md）：**
- scoreTask 再评分原地更新（更新任务+更新同一流水、去掉抛错）→ Task 1 ✓
- 既有「不能重复评分」测试改为「重评更新」→ Task 1 Step 1 ✓
- ScoreForm 预填 initial → Task 2 Step 1 ✓
- 今日页已评分任务「查看/修改」入口 + 传 initial → Task 2 Step 2-3 ✓
- /records 按天回看保持只读、今日页可改任意日期 → 设计内禀（今日页有日期选择器，未改其只读语义）✓
- Modal 组件 → Task 3 Step 1 ✓
- /records 兑换历史/积分流水改按钮+弹窗、按天回看保持内联 → Task 3 Step 2 ✓
- 不加依赖、不改 schema、TDD、既有测试更新后全绿 → 各任务验证步骤 ✓
- 不在奖励商店余额处加入口、不留改分历史轨迹 → 计划未含，符合 YAGNI ✓

**Placeholder scan：** 无 TBD/TODO；改动步骤含完整代码或精确的"只改 X、其余不动"指示。

**Type consistency：** `ScoreForm` 的 `initial` 形状 `{actualMinutes,focused:boolean,usedScaffold:boolean,didCheck:boolean,errorCount,note}`（Task 2 Step 1 定义）与今日页 `initialFor` 产出（Task 2 Step 2，把 0/1 number 转 boolean、null 转默认）一致；`scoreTask` 签名不变，今日页/ScoreForm 调用方式不变；Modal `{open,title,onClose,children}` 在 Task 3 定义与 /records 使用一致。

**注：** `app/page.tsx`、`app/records/page.tsx`、`app/_components/ScoreForm.tsx` 已多次演进，实现者须读实际文件后按"同语义位置"修改（Task 接口、三元渲染段、两个 section、组件签名+useState），不要凭记忆整体替换未指明的部分。
