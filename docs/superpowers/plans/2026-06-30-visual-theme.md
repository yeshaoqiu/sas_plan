# 视觉美化（童趣游戏风 · 全局主题）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给现有 3 页应用套上统一的「童趣游戏风」暖色主题，不改业务逻辑、不加依赖。

**Architecture:** 在 `globals.css` 用 `@layer` 定义共享语义类（.card/.btn/.input/.chip/.balance-badge），`tailwind.config.ts` 设圆润字体栈，`layout.tsx` 改背景与顶栏；三个页面与 ScoreForm 做轻量类替换并加科目色标。一个共享 `subjectMeta.ts` 提供科目→颜色映射。

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v3（纯 Tailwind，无新依赖）。

## Global Constraints

- 不引入任何新依赖（纯 Tailwind v3 + 系统字体栈）。
- 不改动任何业务逻辑、API、仓储、计分；纯样式与标记类调整。
- 纯样式改动**不新增单元测试**；每个任务的验证 = `npx next build` 通过 + `npm test` 仍 16/16 通过。
- 字体栈固定为：`ui-rounded, "SF Pro Rounded", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`（不下载中文字体）。
- 科目色：writing=amber🟡、picture_composition=violet🟣、math=emerald🟢、other=slate⚪。
- 背景暖奶油 `amber-50`；主色 `amber-500`。

---

## File Structure

- `tailwind.config.ts` — 修改：加 `fontFamily.sans` 圆润字体栈。
- `app/globals.css` — 修改：`@layer base` 设 body/标题，`@layer components` 定义共享类。
- `app/layout.tsx` — 修改：body 背景/字体（交给 globals）、顶栏加 emoji logo 与圆角导航。
- `app/_components/subjectMeta.ts` — 新建：科目→{label,dot,chip} 映射。
- `app/page.tsx` — 修改：今日清单类替换 + 科目色点 + 已评分成功 chip。
- `app/_components/ScoreForm.tsx` — 修改：表单容器/输入/按钮主题化。
- `app/manage/page.tsx` — 修改：输入/按钮主题化 + 模板项科目色点。
- `app/rewards/page.tsx` — 修改：余额徽章 + 奖励卡 + 兑换按钮主题化。

---

### Task 1: 全局主题基座（config + globals + layout + subjectMeta）

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `app/_components/subjectMeta.ts`

**Interfaces:**
- Consumes: 无。
- Produces:
  - 共享 CSS 类（供后续任务使用）：`.card`, `.btn`, `.btn-primary`, `.btn-sky`, `.btn-rose`, `.btn-emerald`, `.input`, `.chip`, `.balance-badge`。`.btn` 的 `:disabled` 态统一置灰（覆盖颜色变体）。
  - `SUBJECT_META: Record<Subject, { label: string; dot: string; chip: string }>`（`dot`/`chip` 为 Tailwind 类串）。

- [ ] **Step 1: 设置圆润字体栈**

将 `tailwind.config.ts` 的 `theme` 改为（仅增加 `fontFamily`，其余保持）：
```ts
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-rounded",
          '"SF Pro Rounded"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 2: 写全局基座与共享组件类**

将 `app/globals.css` 整体替换为：
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-amber-50 text-slate-800;
  }
  h1, h2, h3 {
    @apply font-bold tracking-tight;
  }
}

@layer components {
  .card {
    @apply rounded-2xl bg-white p-4 shadow-sm ring-1 ring-amber-100;
  }
  .btn {
    @apply rounded-xl px-4 py-2 font-medium text-white transition-transform duration-100 hover:scale-105 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400;
  }
  .btn-primary { @apply bg-amber-500 hover:bg-amber-600; }
  .btn-sky { @apply bg-sky-500 hover:bg-sky-600; }
  .btn-rose { @apply bg-rose-500 hover:bg-rose-600; }
  .btn-emerald { @apply bg-emerald-500 hover:bg-emerald-600; }
  .input {
    @apply rounded-lg border border-slate-300 px-3 py-1.5 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200;
  }
  .chip {
    @apply inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium;
  }
  .balance-badge {
    @apply inline-flex items-center gap-1 rounded-full bg-amber-100 px-4 py-1.5 text-2xl font-extrabold text-amber-600;
  }
}
```

- [ ] **Step 3: 改顶栏与 body**

将 `app/layout.tsx` 整体替换为（body 的颜色/字体交给 globals base 层；顶栏加 logo 与圆角导航）：
```tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "学习陪跑" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <nav className="flex items-center gap-1 bg-white px-6 py-3 shadow-sm">
          <span className="mr-3 text-lg font-extrabold text-amber-600">🎒 学习陪跑</span>
          <a href="/" className="rounded-full px-3 py-1.5 font-medium hover:bg-amber-100">今日清单</a>
          <a href="/rewards" className="rounded-full px-3 py-1.5 font-medium hover:bg-amber-100">奖励商店</a>
          <a href="/manage" className="rounded-full px-3 py-1.5 font-medium hover:bg-amber-100">管理</a>
        </nav>
        <main className="mx-auto max-w-3xl p-6">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: 新建科目映射**

`app/_components/subjectMeta.ts`:
```ts
import type { Subject } from "@/lib/types";

export const SUBJECT_META: Record<
  Subject,
  { label: string; dot: string; chip: string }
> = {
  writing: { label: "写字", dot: "bg-amber-400", chip: "bg-amber-100 text-amber-700" },
  picture_composition: { label: "看图写话", dot: "bg-violet-400", chip: "bg-violet-100 text-violet-700" },
  math: { label: "数学", dot: "bg-emerald-400", chip: "bg-emerald-100 text-emerald-700" },
  other: { label: "其他", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700" },
};
```

- [ ] **Step 5: 验证 build 与测试**

Run: `npx next build`
Expected: 编译通过，无类型/构建错误。

Run: `npm test`
Expected: 9 files / 16 tests 通过，pristine。

- [ ] **Step 6: 提交**

```bash
git add tailwind.config.ts app/globals.css app/layout.tsx app/_components/subjectMeta.ts
git commit -m "feat: add playful global theme (palette, font, nav, shared classes)"
```

---

### Task 2: 今日清单页 + 评分表单主题化

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/_components/ScoreForm.tsx`

**Interfaces:**
- Consumes: Task 1 的共享类 + `SUBJECT_META`。`app/page.tsx` 已有 `templates` 状态（每项含 `subject`）与 `Template` 接口 `{ id, name, subject }`。
- Produces: 无（页面级）。

- [ ] **Step 1: 今日清单——选择器与派发按钮主题化**

在 `app/page.tsx` 顶部 import 区加入：
```tsx
import { SUBJECT_META } from "./_components/subjectMeta";
```

把孩子选择 `<select>` 和日期 `<input type="date">` 的 `className="rounded border px-2 py-1"`（两处）都替换为 `className="input"`。

把派发任务按钮的 `className="rounded bg-sky-500 px-3 py-1 text-sm text-white"` 替换为 `className="btn btn-sky px-3 py-1 text-sm"`。

- [ ] **Step 2: 今日清单——任务行加科目色点、卡片、成功 chip**

在组件内（`tplName` 附近）新增一个按 templateId 取科目的辅助：
```tsx
const tplSubject = (id: number) => templates.find((t) => t.id === id)?.subject;
```

把任务列表项整块替换为以下结构（`<li>` 用 `.card`，行首加科目色点，已评分用绿色 chip + 🎉，评分按钮用 `.btn btn-primary`）：
```tsx
{tasks.map((t) => {
  const subj = tplSubject(t.templateId);
  return (
    <li key={t.id} className="card">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${subj ? SUBJECT_META[subj].dot : "bg-slate-300"}`} />
          {tplName(t.templateId)}
        </span>
        {t.status === "scored"
          ? <span className="chip bg-emerald-100 text-emerald-700">🎉 已评分 +{t.pointsAwarded}</span>
          : <button onClick={() => setScoring(scoring === t.id ? null : t.id)} className="btn btn-primary px-3 py-1 text-sm">评分</button>}
      </div>
      {scoring === t.id && <ScoreForm taskId={t.id} onDone={() => { setScoring(null); loadTasks(); }} />}
    </li>
  );
})}
```

把空状态项替换为：
```tsx
{tasks.length === 0 && <li className="text-slate-500">🙌 还没有任务，点上面派发。</li>}
```

- [ ] **Step 3: 评分表单主题化**

在 `app/_components/ScoreForm.tsx`：
- 容器 `className="mt-2 space-y-2 rounded bg-slate-100 p-3 text-sm"` → `className="mt-2 space-y-2 rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-100"`
- 两个数字输入 `className="ml-2 w-16 rounded border px-1"` → `className="input ml-2 w-16"`
- 备注输入 `className="w-full rounded border px-2 py-1"` → `className="input w-full"`
- 保存按钮 `className="rounded bg-emerald-500 px-3 py-1 text-white"` → `className="btn btn-emerald"`

- [ ] **Step 4: 验证 build 与测试**

Run: `npx next build`
Expected: 编译通过。

Run: `npm test`
Expected: 16/16 通过。

- [ ] **Step 5: 提交**

```bash
git add app/page.tsx app/_components/ScoreForm.tsx
git commit -m "feat: theme today list and score form"
```

---

### Task 3: 管理页主题化

**Files:**
- Modify: `app/manage/page.tsx`

**Interfaces:**
- Consumes: Task 1 的共享类 + `SUBJECT_META`。`manage/page.tsx` 现有 `templates` 状态（每项含 `subject`）。
- Produces: 无。

- [ ] **Step 1: import 科目映射**

在 `app/manage/page.tsx` 顶部 import 区加入：
```tsx
import { SUBJECT_META } from "../_components/subjectMeta";
```

- [ ] **Step 2: 输入与按钮主题化**

- 所有输入框：把姓名/任务名输入的 `className="rounded border px-2 py-1"` → `className="input"`；年级输入 `className="w-16 rounded border px-2 py-1"` → `className="input w-16"`；科目 `<select>` 的 `className="rounded border px-2 py-1"` → `className="input"`；分钟/基础分两个数字输入 `className="w-20 rounded border px-2 py-1"` → `className="input w-20"`。
- 两个「添加」按钮 `className="rounded bg-sky-500 px-3 py-1 text-white"` → `className="btn btn-primary px-3 py-1"`。

- [ ] **Step 3: 模板列表加科目色点**

把任务模板列表项替换为（行首加科目色点）：
```tsx
{templates.map((t) => (
  <li key={t.id} className="flex items-center gap-2">
    <span className={`h-3 w-3 rounded-full ${SUBJECT_META[t.subject as keyof typeof SUBJECT_META]?.dot ?? "bg-slate-300"}`} />
    {t.name}（{t.basePoints}分 / {t.defaultMinutes}分钟）
  </li>
))}
```

- [ ] **Step 4: 验证 build 与测试**

Run: `npx next build`
Expected: 编译通过。

Run: `npm test`
Expected: 16/16 通过。

- [ ] **Step 5: 提交**

```bash
git add app/manage/page.tsx
git commit -m "feat: theme manage page"
```

---

### Task 4: 奖励商店页主题化

**Files:**
- Modify: `app/rewards/page.tsx`

**Interfaces:**
- Consumes: Task 1 的共享类（`.balance-badge`, `.card`, `.btn`, `.btn-rose`, `.btn-primary`, `.input`）。
- Produces: 无。

- [ ] **Step 1: 余额徽章与选择器**

在 `app/rewards/page.tsx`：
- 孩子选择 `<select>` 的 `className="rounded border px-2 py-1"` → `className="input"`。
- 余额 `<span className="text-2xl font-bold text-amber-500">⭐ {balance}</span>` → `<span className="balance-badge">⭐ {balance}</span>`。

- [ ] **Step 2: 奖励卡与兑换按钮**

- 奖励列表 `<li>` 的 `className="flex items-center justify-between rounded bg-white p-3 shadow-sm"` → `className="card flex items-center justify-between"`。
- 兑换按钮 `className="rounded bg-rose-500 px-3 py-1 text-white disabled:bg-slate-300"` → `className="btn btn-rose px-3 py-1"`（禁用态由 `.btn:disabled` 统一处理；`disabled={balance < r.cost}` 保留）。

- [ ] **Step 3: 新增奖励表单**

- 奖励名输入 `className="rounded border px-2 py-1"` → `className="input"`；金额数字输入 `className="w-24 rounded border px-2 py-1"` → `className="input w-24"`。
- 「新增奖励」按钮 `className="rounded bg-sky-500 px-3 py-1 text-white"` → `className="btn btn-primary px-3 py-1"`。

- [ ] **Step 4: 验证 build 与测试**

Run: `npx next build`
Expected: 编译通过。

Run: `npm test`
Expected: 16/16 通过。

- [ ] **Step 5: 提交**

```bash
git add app/rewards/page.tsx
git commit -m "feat: theme reward shop page"
```

---

## Self-Review

**Spec coverage（对照 2026-06-30-visual-theme-design.md）：**
- 暖色背景/主色/字体栈 → Task 1（globals base + tailwind.config）✓
- 共享类 .card/.btn/.btn-*/.input/.chip/.balance-badge + disabled 置灰 → Task 1 ✓
- 顶栏 emoji logo + 圆角导航 → Task 1 ✓
- 科目色标（4 色）→ Task 1 `subjectMeta.ts`，应用于 Task 2（今日任务行）、Task 3（模板项）✓
- 今日清单 / ScoreForm 类替换 + 已评分成功 chip → Task 2 ✓
- 管理页类替换 + 科目色点 → Task 3 ✓
- 奖励商店余额徽章 + 卡片 + 兑换按钮（禁用态）→ Task 4 ✓
- 不加依赖、不改逻辑、test 保持 16/16、build 通过 → 各任务验证步骤 ✓
- 宠物/等级/动效不做（里程碑 3）→ 计划未含，符合 ✓

**Placeholder scan：** 无 TBD/TODO；每个改动步骤给出确切的 find→replace 类串与完整新文件内容。

**Type consistency：** `SUBJECT_META` 在 Task 1 定义为 `Record<Subject,{label,dot,chip}>`，Task 2/3 按 `SUBJECT_META[subject].dot` 使用，键与 `Subject` 联合类型一致；`.btn` 系列、`.card`、`.input`、`.balance-badge` 类名在定义（Task 1）与使用（Task 2-4）处拼写一致。

**注：** 各页面当前的散装类串（如 `rounded bg-sky-500 px-3 py-1 text-white`）由实现者读取实际文件确认后替换；若某类串因既有修复（如 res.ok 守卫）位置微调，按"同语义元素"定位替换即可，逻辑不动。
