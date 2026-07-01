# 管理页子标签整理 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把管理页的 7 个配置区块用 5 个页内子标签归组，一次只看一组。

**Architecture:** 仅改 `app/manage/page.tsx`（客户端组件）：加 `tab` 状态 + 顶部标签栏，把现有各 `<section>` 包进对应标签的条件渲染面板。数据/逻辑不变。

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind v3。

## Global Constraints

- 不引入新依赖；不改 API/仓储/数据模型；不改各区块内部表单/字段/handler。
- 5 标签：`children`(孩子) / `tasks`(任务模板+每日计划) / `rewards`(奖励) / `scoring`(加分项+评分设置) / `archived`(已归档)；默认 `children`。
- 沿用主题类；当前标签用橙色实心胶囊（`bg-amber-500 text-white`），非当前 `hover:bg-amber-100`。
- 切标签不重新请求数据（`reload()` 仍一次拉全）。
- 既有 55 项测试保持通过；`npx next build` 通过；逐标签浏览器截图验证。

---

## File Structure

- `app/manage/page.tsx` — 修改：加 `tab` 状态 + 标签栏，将 7 个 section 归入 5 个条件面板。

---

### Task 1: 管理页子标签归组

**Files:**
- Modify: `app/manage/page.tsx`
- 验证：`npx next build` + 浏览器逐标签截图

**Interfaces:**
- Consumes: 现有 manage 页的全部 state/handler/派生变量（不变）。
- Produces: 无（页面级）。

- [ ] **Step 1: 加 tab 状态与标签定义**

在 `app/manage/page.tsx` 组件内（其它 `useState` 附近）新增：
```tsx
const [tab, setTab] = useState<"children" | "tasks" | "rewards" | "scoring" | "archived">("children");
```
在组件外（文件顶部、`export default` 之前）加标签定义：
```tsx
const TABS = [
  { key: "children", label: "孩子" },
  { key: "tasks", label: "任务" },
  { key: "rewards", label: "奖励" },
  { key: "scoring", label: "评分" },
  { key: "archived", label: "已归档" },
] as const;
```

- [ ] **Step 2: 顶部标签栏**

在最外层容器（现有的 `<div className="space-y-8">`）内**最前面**插入标签栏：
```tsx
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${tab === t.key ? "bg-amber-500 text-white" : "hover:bg-amber-100"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
```

- [ ] **Step 3: 将现有 section 归入条件面板**

READ 文件确认现有各 `<section>`，按下列分组分别用 `{tab === "…" && ( … )}` 包裹（**不改 section 内部内容**，仅在其外层加条件；相邻同组的两个 section 用一个 `{tab === "…" && (<>…</>)}` 包住）：

- 「孩子」section → `{tab === "children" && ( <section>…孩子…</section> )}`
- 「任务模板」section 与 「每日计划」section → 一起放进：
  ```tsx
  {tab === "tasks" && (
    <>
      {/* 任务模板 section 原样 */}
      {/* 每日计划 section 原样 */}
    </>
  )}
  ```
- 「奖励」section → `{tab === "rewards" && ( <section>…奖励…</section> )}`
- 「加分项」section 与 「评分设置」section → 一起放进：
  ```tsx
  {tab === "scoring" && (
    <>
      {/* 加分项 section 原样 */}
      {/* 评分设置 section 原样 */}
    </>
  )}
  ```
- 「已归档」section → `{tab === "archived" && ( <section>…已归档…</section> )}`

保持外层 `<div className="space-y-8">` 不变（标签栏作为其第一个子元素，各面板随后）。不改任何 state、handler、`reload()`、`toggle`、派生变量。

- [ ] **Step 4: build + 全量测试**

Run: `npx next build`
Expected: 编译通过（`/manage` 正常构建）。

Run: `npm test`
Expected: 55/55 全绿（UI 归组不影响测试）。

- [ ] **Step 5: 浏览器验证**

Run: `npm run dev`，打开 `/manage`，依次点五个标签
Expected: 默认「孩子」；每个标签只显示其分组区块（任务=模板+每日计划、评分=加分项+设置、已归档单独）；增删改/归档/恢复/评分设置保存等操作在各标签内仍正常。

- [ ] **Step 6: 提交**

```bash
git add app/manage/page.tsx
git commit -m "feat: group manage page config into tabs"
```

---

## Self-Review

**Spec coverage（对照 2026-07-01-manage-tabs-design.md）：**
- 5 子标签 + 默认 children → Step 1-2 ✓
- 分组：孩子 / 任务(模板+每日计划) / 奖励 / 评分(加分项+设置) / 已归档 → Step 3 ✓
- 仅改 page.tsx、不动数据/逻辑 → Step 3 约束 ✓
- 主题类、active pill、切标签不重拉 → Step 2 + 约束 ✓
- 验证 build + 逐标签截图 → Step 4-5 ✓
- 不拆子组件、不改内部表单、无状态持久化 → 计划未含，符合 YAGNI ✓

**Placeholder scan：** 无 TBD/TODO；标签栏/状态代码完整；section 归组以"读实际文件按同语义位置包裹"表述（section 内容已存在、原样保留，不需在计划里重抄）。

**Type consistency：** `tab` 联合类型的 5 个值与 `TABS[].key` 及各 `tab === "…"` 判断一致（children/tasks/rewards/scoring/archived）。

**注：** `app/manage/page.tsx` 是已演进的大文件，实现者须读实际文件，仅在每个既有 `<section>` 外层加条件包裹并在顶部加标签栏，绝不改动 section 内部或任何逻辑。