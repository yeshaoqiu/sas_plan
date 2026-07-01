# 可配置评分：管理端 UI + API 实现计划 — Plan 2/3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 家长可在管理页维护加分项（增删改名/分值/说明/归档）与评分设置（按时加分/错题扣分/最低分）。

**Architecture:** 加分项/评分设置 API 薄包装既有仓储（`bonusItems`/`scoringSettings`）。/manage 新增「加分项」区（行内编辑 + 归档/恢复，沿用现有 CRUD 交互）与「评分设置」区（三字段编辑保存）。

**Tech Stack:** Next.js 15 App Router, TypeScript, better-sqlite3, Vitest, Tailwind v3。

## Global Constraints

- 不引入新依赖；薄 handler：parse → repo → NextResponse.json；Next.js 15 async params `Promise<{id}>` 需 await。
- 加分项 API 与既有 children/templates/rewards 一致：`GET ?all=1` 含归档；`PATCH [id]`；`POST [id]/archive`、`[id]/restore`。
- 评分设置是单例：`GET/PATCH /api/scoring-settings`（无 id 段）。
- 沿用管理页现有 CRUD 交互与主题类；归档的加分项进入现有「已归档」区、可恢复。
- 既有 52 项测试保持通过；UI 以 `npx next build` 通过 + 截图验证。

---

## File Structure

- `app/api/bonus-items/route.ts` — 新建：GET（?all=1）/POST。
- `app/api/bonus-items/[id]/route.ts` — 新建：PATCH。
- `app/api/bonus-items/[id]/archive/route.ts`、`.../restore/route.ts` — 新建：POST。
- `app/api/scoring-settings/route.ts` — 新建：GET/PATCH。
- `app/manage/page.tsx` — 修改：加「加分项」区 + 「评分设置」区；已归档区纳入加分项。

---

### Task 1: 加分项 API

**Files:**
- Create: `app/api/bonus-items/route.ts`, `app/api/bonus-items/[id]/route.ts`, `app/api/bonus-items/[id]/archive/route.ts`, `app/api/bonus-items/[id]/restore/route.ts`
- Test: `tests/api-bonus-items.test.ts`

**Interfaces:**
- Consumes: `getDb`、`listBonusItems`/`listAllBonusItems`/`createBonusItem`/`updateBonusItem`/`archiveBonusItem`/`restoreBonusItem`（Plan 1 已建）。
- Produces:
  - `GET /api/bonus-items` → active `BonusItem[]`；`?all=1` → 全部。
  - `POST /api/bonus-items` body `{name, description?, points, sortOrder?}` → 新 `BonusItem`。
  - `PATCH /api/bonus-items/[id]` body `{name, description, points, sortOrder}` → 更新后的 `BonusItem`。
  - `POST /api/bonus-items/[id]/archive`、`/restore` → `{ok:true}`。

- [ ] **Step 1: list/create route**

`app/api/bonus-items/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listBonusItems, listAllBonusItems, createBonusItem } from "@/lib/repositories/bonusItems";

export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const db = getDb();
  return NextResponse.json(all ? listAllBonusItems(db) : listBonusItems(db));
}

export async function POST(req: Request) {
  const body = await req.json();
  const item = createBonusItem(getDb(), {
    name: body.name,
    description: body.description,
    points: Number(body.points),
    sortOrder: body.sortOrder === undefined ? undefined : Number(body.sortOrder),
  });
  return NextResponse.json(item);
}
```

- [ ] **Step 2: PATCH route**

`app/api/bonus-items/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { updateBonusItem } from "@/lib/repositories/bonusItems";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const item = updateBonusItem(getDb(), Number(id), {
    name: body.name,
    description: body.description,
    points: Number(body.points),
    sortOrder: Number(body.sortOrder),
  });
  return NextResponse.json(item);
}
```

- [ ] **Step 3: archive/restore routes**

`app/api/bonus-items/[id]/archive/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { archiveBonusItem } from "@/lib/repositories/bonusItems";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  archiveBonusItem(getDb(), Number(id));
  return NextResponse.json({ ok: true });
}
```

`app/api/bonus-items/[id]/restore/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { restoreBonusItem } from "@/lib/repositories/bonusItems";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  restoreBonusItem(getDb(), Number(id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: 集成测试**

`tests/api-bonus-items.test.ts`:
```ts
import { expect, test } from "vitest";

process.env.DB_PATH = ":memory:";

test("bonus-items create/list/patch/archive/all-list", async () => {
  const mod = await import("@/app/api/bonus-items/route");
  // seeded 3 active
  const seeded = await (await mod.GET(new Request("http://x/api/bonus-items"))).json();
  expect(seeded.length).toBe(3);

  const created = await (await mod.POST(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "字迹工整", description: "写得整齐", points: 4, sortOrder: 9 }) }))).json();
  expect(created.name).toBe("字迹工整");
  expect(created.points).toBe(4);

  const idMod = await import("@/app/api/bonus-items/[id]/route");
  const params = { params: Promise.resolve({ id: String(created.id) }) };
  const patched = await (await idMod.PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ name: "字迹工整", description: "写得整齐好看", points: 6, sortOrder: 9 }) }), params)).json();
  expect(patched.points).toBe(6);

  const arch = await import("@/app/api/bonus-items/[id]/archive/route");
  await arch.POST(new Request("http://x", { method: "POST" }), params);
  const active = await (await mod.GET(new Request("http://x/api/bonus-items"))).json();
  const all = await (await mod.GET(new Request("http://x/api/bonus-items?all=1"))).json();
  expect(active.find((b: { id: number }) => b.id === created.id)).toBeUndefined();
  expect(all.find((b: { id: number }) => b.id === created.id)?.active).toBe(0);
});
```

- [ ] **Step 5: 运行测试 + build + 全量**

Run: `npm test -- tests/api-bonus-items.test.ts` → PASS
Run: `npx next build` → 编译通过（新路由出现）。
Run: `npm test` → 全绿。

- [ ] **Step 6: 提交**

```bash
git add app/api/bonus-items tests/api-bonus-items.test.ts
git commit -m "feat: bonus items API (list/create/patch/archive/restore)"
```

---

### Task 2: 评分设置 API

**Files:**
- Create: `app/api/scoring-settings/route.ts`
- Test: `tests/api-scoring-settings.test.ts`

**Interfaces:**
- Consumes: `getDb`、`getScoringSettings`/`updateScoringSettings`（Plan 1 已建）。
- Produces:
  - `GET /api/scoring-settings` → `ScoringSettings`（`{onTimeBonus,errorPenalty,minPoints}`）。
  - `PATCH /api/scoring-settings` body `{onTimeBonus,errorPenalty,minPoints}` → 更新后的 `ScoringSettings`。

- [ ] **Step 1: route**

`app/api/scoring-settings/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getScoringSettings, updateScoringSettings } from "@/lib/repositories/scoringSettings";

export async function GET() {
  return NextResponse.json(getScoringSettings(getDb()));
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const s = updateScoringSettings(getDb(), {
    onTimeBonus: Number(body.onTimeBonus),
    errorPenalty: Number(body.errorPenalty),
    minPoints: Number(body.minPoints),
  });
  return NextResponse.json(s);
}
```

- [ ] **Step 2: 集成测试**

`tests/api-scoring-settings.test.ts`:
```ts
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
```

- [ ] **Step 3: 运行测试 + build + 全量**

Run: `npm test -- tests/api-scoring-settings.test.ts` → PASS
Run: `npx next build` → 编译通过。
Run: `npm test` → 全绿。

- [ ] **Step 4: 提交**

```bash
git add app/api/scoring-settings tests/api-scoring-settings.test.ts
git commit -m "feat: scoring settings API (get/patch)"
```

---

### Task 3: /manage 加分项区

**Files:**
- Modify: `app/manage/page.tsx`
- 验证：`npx next build` + 截图

**Interfaces:**
- Consumes: `/api/bonus-items?all=1`、`PATCH /api/bonus-items/[id]`、`POST /api/bonus-items/[id]/archive|restore`。
- Produces: 无。

- [ ] **Step 1: 加载加分项 + 编辑态 + 新增输入**

在 `app/manage/page.tsx` 组件内新增状态：
```tsx
interface BonusRow { id: number; name: string; description: string; points: number; active: number; sortOrder: number }
```
```tsx
const [bonusItems, setBonusItems] = useState<BonusRow[]>([]);
const [editBonus, setEditBonus] = useState<BonusRow | null>(null);
const [bName, setBName] = useState("");
const [bDesc, setBDesc] = useState("");
const [bPoints, setBPoints] = useState(5);
```
在既有 `reload()` 内追加：
```tsx
    fetch("/api/bonus-items?all=1").then((r) => r.json()).then(setBonusItems);
```
派生（与 activeChildren 等并列）：
```tsx
const activeBonus = bonusItems.filter((b) => b.active === 1);
const archivedBonus = bonusItems.filter((b) => b.active === 0);
```

- [ ] **Step 2: 处理函数**

在组件内新增：
```tsx
async function addBonus() {
  await fetch("/api/bonus-items", { method: "POST", body: JSON.stringify({ name: bName, description: bDesc, points: bPoints, sortOrder: activeBonus.length }) });
  setBName(""); setBDesc(""); reload();
}
async function saveBonus() {
  if (!editBonus) return;
  await fetch(`/api/bonus-items/${editBonus.id}`, { method: "PATCH", body: JSON.stringify(editBonus) });
  setEditBonus(null); reload();
}
```
（归档/恢复复用现有 `toggle("bonus-items", id, "archive"|"restore")` 助手——它请求 `/api/${kind}/${id}/${action}` 并 reload；kind 传 `"bonus-items"`，与路由目录一致。）

- [ ] **Step 3: 渲染「加分项」区**

在「每日计划」区之后、「已归档」区之前插入：
```tsx
      <section>
        <h2 className="mb-2 font-semibold">加分项（评分时可勾选）</h2>
        <ul className="mb-2 space-y-1">
          {activeBonus.map((b) => (
            <li key={b.id} className="flex items-center gap-2">
              {editBonus?.id === b.id ? (
                <>
                  <input className="input w-28" value={editBonus.name} onChange={(e) => setEditBonus({ ...editBonus, name: e.target.value })} />
                  <input className="input flex-1" value={editBonus.description} onChange={(e) => setEditBonus({ ...editBonus, description: e.target.value })} />
                  <input type="number" className="input w-16" value={editBonus.points} onChange={(e) => setEditBonus({ ...editBonus, points: +e.target.value })} />
                  <button className="btn btn-emerald px-3 py-1 text-sm" onClick={saveBonus}>保存</button>
                  <button className="text-sm text-slate-500" onClick={() => setEditBonus(null)}>取消</button>
                </>
              ) : (
                <>
                  <span>{b.name} <span className="text-amber-600">+{b.points}</span> <span className="text-xs text-slate-500">{b.description}</span></span>
                  <button className="text-sm text-sky-600" onClick={() => setEditBonus(b)}>编辑</button>
                  <button className="text-sm text-rose-500" onClick={() => toggle("bonus-items", b.id, "archive")}>归档</button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <input placeholder="名称" value={bName} onChange={(e) => setBName(e.target.value)} className="input w-28" />
          <input placeholder="说明" value={bDesc} onChange={(e) => setBDesc(e.target.value)} className="input flex-1" />
          <input type="number" value={bPoints} onChange={(e) => setBPoints(+e.target.value)} className="input w-16" placeholder="分值" />
          <button onClick={addBonus} className="btn btn-primary px-3 py-1">添加</button>
        </div>
      </section>
```

- [ ] **Step 4: 已归档区纳入加分项**

在现有「已归档」区的列表里，追加归档加分项的渲染（与 archivedChildren/Tpls/Rewards 并列）：
```tsx
          {archivedBonus.map((b) => (
            <li key={`b${b.id}`} className="flex items-center gap-2">
              <span>⭐ {b.name}</span>
              <button className="text-emerald-600" onClick={() => toggle("bonus-items", b.id, "restore")}>恢复</button>
            </li>
          ))}
```
并把该区"暂无已归档项"的空判断补上 bonus（若现有空判断是 `archivedChildren.length + archivedTpls.length + archivedRewards.length === 0`，改为再 `+ archivedBonus.length`）。

- [ ] **Step 5: build + 全量测试**

Run: `npx next build` → 编译通过。
Run: `npm test` → 全绿。

- [ ] **Step 6: 浏览器验证**

Run: `npm run dev`，打开 `/manage`
Expected: 「加分项」区列出专注完成/用上支架/做了检查（含 +5 与说明）；可新增、行内编辑（名/说明/分值）、归档（移入已归档，可恢复）。

- [ ] **Step 7: 提交**

```bash
git add app/manage/page.tsx
git commit -m "feat: bonus items management section on manage page"
```

---

### Task 4: /manage 评分设置区

**Files:**
- Modify: `app/manage/page.tsx`
- 验证：`npx next build` + 截图

**Interfaces:**
- Consumes: `GET /api/scoring-settings`、`PATCH /api/scoring-settings`。
- Produces: 无。

- [ ] **Step 1: 状态 + 加载**

在 `app/manage/page.tsx` 组件内新增：
```tsx
const [settings, setSettings] = useState<{ onTimeBonus: number; errorPenalty: number; minPoints: number }>({ onTimeBonus: 3, errorPenalty: 2, minPoints: 1 });
```
在 `reload()` 内追加：
```tsx
    fetch("/api/scoring-settings").then((r) => r.json()).then(setSettings);
```

- [ ] **Step 2: 保存函数**

```tsx
async function saveSettings() {
  const s = await fetch("/api/scoring-settings", { method: "PATCH", body: JSON.stringify(settings) }).then((r) => r.json());
  setSettings(s);
  alert("评分设置已保存");
}
```

- [ ] **Step 3: 渲染「评分设置」区**

在「加分项」区之后（「已归档」区之前）插入：
```tsx
      <section>
        <h2 className="mb-2 font-semibold">评分设置</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1">按时加分
            <input type="number" className="input w-16" value={settings.onTimeBonus} onChange={(e) => setSettings({ ...settings, onTimeBonus: +e.target.value })} />
          </label>
          <label className="flex items-center gap-1">错题扣分
            <input type="number" className="input w-16" value={settings.errorPenalty} onChange={(e) => setSettings({ ...settings, errorPenalty: +e.target.value })} />
          </label>
          <label className="flex items-center gap-1">最低分
            <input type="number" className="input w-16" value={settings.minPoints} onChange={(e) => setSettings({ ...settings, minPoints: +e.target.value })} />
          </label>
          <button onClick={saveSettings} className="btn btn-primary px-3 py-1">保存</button>
        </div>
        <p className="mt-1 text-xs text-slate-500">得分 = 基础分 + 已勾选加分项 + 按时加分（用时≤模板时长）− 错题数×错题扣分，最低不低于最低分。</p>
      </section>
```

- [ ] **Step 4: build + 全量测试**

Run: `npx next build` → 编译通过。
Run: `npm test` → 全绿。

- [ ] **Step 5: 浏览器验证**

Run: `npm run dev`，打开 `/manage`
Expected: 「评分设置」区显示按时加分/错题扣分/最低分（默认 3/2/1），改值保存后刷新保持；底部有计分公式说明。

- [ ] **Step 6: 提交**

```bash
git add app/manage/page.tsx
git commit -m "feat: scoring settings section on manage page"
```

---

## Self-Review

**Spec coverage（对照 2026-07-01-configurable-scoring-design.md §5-§6 的管理部分）：**
- 加分项 API（list ?all / create / patch / archive / restore）→ Task 1 ✓
- 评分设置 API（get / patch）→ Task 2 ✓
- /manage 加分项区（CRUD + 归档/恢复 + 已归档纳入）→ Task 3 ✓
- /manage 评分设置区（按时加分/错题扣分/最低分编辑 + 公式说明）→ Task 4 ✓
- 计分引擎/数据模型 → Plan 1（已完成）；评分表单动态化 + 说明 + 展示 → Plan 3。

**Placeholder scan：** 无 TBD/TODO；每步含完整代码与命令。

**Type consistency：** `BonusItem`/`ScoringSettings`（Plan 1）经 API（Task 1/2）透传，UI（Task 3/4）以 `BonusRow`/内联设置类型消费，字段名一致（name/description/points/active/sortOrder；onTimeBonus/errorPenalty/minPoints）；加分项路由目录 `bonus-items` 与 `toggle("bonus-items", …)` 一致；PATCH 送整行/整设置对象，后端只取已知字段。

**注：** `app/manage/page.tsx` 已多次演进，实现者须读实际文件，按"同语义位置"集成（reload 内追加、派生变量并列、已归档区追加、区块顺序：每日计划→加分项→评分设置→已归档），复用既有 `toggle` 助手与主题类，不整体覆盖未指明部分。
