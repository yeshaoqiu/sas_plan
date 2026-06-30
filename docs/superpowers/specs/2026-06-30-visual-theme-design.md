# 视觉美化（童趣游戏风 · 全局主题）— 设计文档

- 日期：2026-06-30
- 状态：已确认，待编写实现计划
- 关联：里程碑 1 MVP（已完成）的 UI 美化 pass

## 1. 背景与目标

MVP（里程碑 1）按 YAGNI 只做了最朴素的 UI：系统默认字体、冷灰背景、扁平蓝按钮、大片留白，工具感强、对一二年级孩子吸引力弱。本次做一轮**全局视觉美化**，在不改动业务逻辑、不引入新依赖的前提下，让界面更童趣、更有游戏激励感，同时家长仍可正常使用。

## 2. 范围

**只做全局主题**，不逐页重排布局：

- 改全局文件：`app/layout.tsx`、`app/globals.css`、`tailwind.config.ts`。
- 三个页面（`app/page.tsx`、`app/manage/page.tsx`、`app/rewards/page.tsx`）只做**轻量类替换**：把散装 Tailwind 类（如 `bg-sky-500`、`rounded`）换成共享语义类（`.btn-primary`、`.card` 等），不重排每页结构。
- `app/_components/ScoreForm.tsx` 同样做轻量类替换。

**不做**：宠物/等级/动效（属里程碑 3）、新组件库、新依赖、逻辑变更。

## 3. 视觉风格：童趣游戏风（暖色）

### 调色板
- 背景：暖奶油 `amber-50`（替代冷灰 `slate-50`）。
- 主色：友好橙 `amber-400 / amber-500`。
- 点缀：天蓝 `sky-500`、叶绿 `emerald-500`、珊瑚 `rose-500`。
- 文字主色：`slate-800`（暖灰，正文）；标题更粗。

### 科目色标（subject → 颜色）
- `writing`（写字）→ 琥珀 amber 🟡
- `picture_composition`（看图写话）→ 紫 violet 🟣
- `math`（数学）→ 绿 emerald 🟢
- `other`（其他）→ 灰 slate ⚪

用于任务行/模板项左侧的色条或小圆点，帮助一眼区分科目。

### 字体与字号
- 字体栈：系统圆润字体优先 `ui-rounded, "SF Pro Rounded", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`（不下载中文字体文件，避免数 MB 体积；本地/离线可用）。
- 正文基准字号略增大（孩子友好）；标题更圆更粗。

## 4. 全局实现细节

### 4.1 `tailwind.config.ts`
- 在 `theme.extend` 增加少量语义色别名（可选，便于复用），如 `brand`（=amber-500）；或直接使用 Tailwind 内置 amber/sky/emerald/violet，不强制新增。
- 设置 `theme.extend.fontFamily.sans` 为上面的圆润字体栈。

### 4.2 `app/globals.css`（`@layer components`）
定义共享语义类，供各页替换使用：
- `.card` — 白底、`rounded-2xl`、柔和阴影（`shadow-sm` 加重）、内边距。
- `.btn` — 基础按钮：圆角（`rounded-xl`）、`font-medium`、`transition`、hover 轻微放大（`hover:scale-105`）、`active:scale-95`。
- `.btn-primary` — 橙色实心（`bg-amber-500 text-white hover:bg-amber-600`）。
- `.btn-sky` / `.btn-rose` — 蓝色/珊瑚色变体（用于派发任务、兑换等）。
- `.btn:disabled` — 明显置灰（`bg-slate-200 text-slate-400 cursor-not-allowed`，禁用放大）。
- `.input` — 圆角输入框（`rounded-lg border px-3 py-1.5 focus:ring`）。
- `.chip` — 小圆角标签（用于科目色标/状态）。
- `.balance-badge` — 积分余额徽章：琥珀底、圆角、大号粗体、含 ⭐。

### 4.3 `app/layout.tsx`
- `body` 背景改暖奶油；应用圆润字体栈。
- 顶栏：暖色 header（白底/微琥珀），左侧 emoji logo「🎒 学习陪跑」，导航项做成圆角；视觉上更友好（当前页高亮可后续在页面内处理，本次至少统一为 pill 样式的 hover/active 视觉）。

### 4.4 页面轻量替换
- `app/page.tsx`：派发按钮 → `.btn .btn-sky`；任务卡 → `.card`；评分按钮 → `.btn`（琥珀）；「已评分 +N」→ 绿色成功 `.chip` + 🎉；空状态文案配 emoji；任务行加科目色标。
- `app/_components/ScoreForm.tsx`：表单容器圆角化、输入用 `.input`、保存按钮 `.btn-primary`。
- `app/manage/page.tsx`：列表项与表单输入用 `.card`/`.input`，添加按钮 `.btn-primary`；模板项加科目色标。
- `app/rewards/page.tsx`：余额用 `.balance-badge`；奖励项 → `.card`；兑换按钮 `.btn .btn-rose`，禁用态走 `.btn:disabled`。

## 5. 约束

- 不引入任何新依赖（纯 Tailwind v3 + 系统字体）。
- 不改动任何业务逻辑、API、仓储、计分。
- `npm test` 保持 16/16 通过；`npx next build` 保持通过。

## 6. 验证

- 纯样式改动，无新单元测试。
- 验证方式：`npx next build` 通过 + 启动 dev server 用浏览器对三页重新截图，与改造前对比确认童趣风落地、无布局错乱。
