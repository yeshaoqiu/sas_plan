# 每日计划自动派发 + 任务时间戳 — 设计文档

- 日期：2026-06-30
- 状态：已确认，待编写实现计划
- 关联：在 MVP + 主题 + 管理CRUD + 记录 + 评分编辑 之上扩展

## 1. 背景与目标

当前每天的任务靠家长在今日页手动逐个「派发」。本次：

1. 让每个孩子有一套**可配置的每日任务计划**，并在**打开应用时自动生成**当天清单（电脑夜间关机也不漏）；手动临时派发继续保留。
2. 给每项任务记录**开始时间、完成时间、评分时间**，并在记录里展示。

## 2. 数据模型变更（沿用 db.ts 幂等迁移）

- 新表 `daily_plan`：
  ```sql
  CREATE TABLE IF NOT EXISTS daily_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL REFERENCES children(id),
    template_id INTEGER NOT NULL REFERENCES task_templates(id)
  );
  ```
- `task_instances` 新增三列（迁移用 `ALTER TABLE ADD COLUMN`，缺列才加）：
  - `started_at TEXT`、`completed_at TEXT`、`scored_at TEXT`（均可空）。
- 任务状态枚举扩展：`'pending' | 'in_progress' | 'done' | 'scored'`（新增 `in_progress`，启用原闲置的 `done`）。`TaskStatus` 类型相应更新。

## 3. 块一：每日计划 + 自动派发

### 3.1 每日计划配置（/manage 新增「每日计划」区）
- 每个孩子一行，列出全部**未归档**任务模板，勾选 = 纳入该孩子每日计划。
- 仓储（`lib/repositories/dailyPlan.ts`）：
  - `listDailyPlan(db, childId): number[]`（返回 templateId 数组）
  - `addToDailyPlan(db, childId, templateId)`（已存在则不重复）
  - `removeFromDailyPlan(db, childId, templateId)`
- 归档的模板不在勾选列表出现；若计划里某模板后被归档，自动派发时跳过它（按未归档模板生成）。

### 3.2 自动派发（打开应用惰性确保）
- `ensureDailyTasks(db, childId, date): TaskInstance[]`：
  - 若该 child+date **已有任意 task_instances** → 不创建，返回现有列表（幂等）。
  - 否则按该孩子 `daily_plan` 中**仍未归档**的模板，每个创建一条 `pending` 任务（`assignTask`），返回新建列表。
  - 计划为空 → 不创建。
- 触发：今日页在加载/切换日期时，若**所选日期 ≥ 今天（本地）**，先调 `POST /api/children/[id]/ensure-day`（body `{date}`）再拉任务。过去日期不调用（不补历史空白）。

### 3.3 手动派发（保留现状）
- 今日页「派发任务」按钮不变，可随时临时加任务。
- 与自动并存：自动仅在"当天零任务"时生成；之后手动仍可继续加；若先手动加了，自动当天不再生成。

## 4. 块二：任务时间戳（生命周期）

### 4.1 状态流转与今日页按钮
- `pending` → 「开始」：记 `started_at = now`，状态转 `in_progress`。
- `in_progress` → 「完成」：记 `completed_at = now`，状态转 `done`。
- `done` → 「评分」：打开评分表单；保存时记 `scored_at` + 得分，状态转 `scored`（沿用既有 upsert scoreTask）。
- `scored` → 显示 `🎉 已评分 +N` + 「查看/修改」（沿用上一轮）。
- `scored_at` 仅首次评分时写入；重评保留原值（`scored_at = COALESCE(scored_at, now)`）。

### 4.2 仓储
- `startTask(db, taskId, now?)`：`UPDATE ... SET started_at=?, status='in_progress' WHERE id=?`，返回任务。
- `completeTask(db, taskId, now?)`：`UPDATE ... SET completed_at=?, status='done' WHERE id=?`，返回任务。
- `scoreTask` 扩展：在既有 UPDATE 中加 `scored_at = COALESCE(scored_at, ?)`（传 now）。其余 upsert 逻辑不变。
- `TaskInstance` 类型加 `startedAt: string | null`、`completedAt: string | null`、`scoredAt: string | null`；`toTask` 映射相应字段。

### 4.3 记录页展示
- 「按天回看任务」每项除状态/得分外，展示三个时间：开始 / 完成 / 评分，未发生显示「—」。格式同现有 `fmt`（`YYYY-MM-DD HH:mm`）。

## 5. 架构与接口

- 仓储：新增 `lib/repositories/dailyPlan.ts`；`lib/repositories/tasks.ts` 加 `ensureDailyTasks`、`startTask`、`completeTask`，扩展 `scoreTask`、`toTask`、`TaskInstance`。
- API：
  - `GET /api/children/[id]/daily-plan` → templateId[]；`POST`（body `{templateId}`）加入；`DELETE`（body `{templateId}`）移除。
  - `POST /api/children/[id]/ensure-day`（body `{date}`）→ 任务列表。
  - `POST /api/tasks/[id]/start`、`POST /api/tasks/[id]/complete`。
- UI：
  - `app/manage/page.tsx`：新增「每日计划」区（按孩子勾选模板）。
  - `app/page.tsx`：生命周期按钮（开始/完成/评分）；加载时对 date≥今天调 ensure-day。
  - `app/records/page.tsx`：按天回看展示三时间戳。
- 沿用童趣主题共享类。

## 6. 拆分（两个实现计划）

1. **每日计划 + 自动派发**：daily_plan 表 + 迁移、dailyPlan 仓储、ensureDailyTasks、API、/manage 每日计划区、今日页 ensure-day 接入。
2. **任务时间戳生命周期**：task_instances 三列 + 迁移、状态枚举扩展、startTask/completeTask、scoreTask 记 scored_at、今日页 开始/完成 按钮、/records 时间戳展示。

两块独立，各自可跑通、可验证。先做计划 1，再做计划 2。

## 7. 约束与测试

- 不引入新依赖；迁移幂等（缺列/缺表才建）。
- TDD（仓储）：daily plan 增删查、ensureDailyTasks 幂等与计划为空/含归档模板的行为、startTask/completeTask 置时间与状态、scoreTask 记 scored_at 且重评保留。
- 既有测试保持通过（注意：状态枚举扩展、scoreTask 多写 scored_at 不应破坏既有断言；如有断言需相应更新）。
- UI 以 `npx next build` 通过 + 浏览器截图验证。

## 8. 不做（YAGNI）

- 不做真正的后台/OS 定时任务（采用打开时惰性生成）。
- 不做每日计划的"工作日/周末不同""节假日跳过"等排程（仅一套每日模板集）。
- 不做计时器倒计时 UI（开始/完成仅记录时间点）。
- 周报/规则引擎/AI/养成/排行榜等后续里程碑不在此范围。
