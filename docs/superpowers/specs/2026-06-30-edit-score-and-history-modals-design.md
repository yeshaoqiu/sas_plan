# 评分可查看/修改 + 兑换历史/积分流水弹窗 — 设计文档

- 日期：2026-06-30
- 状态：已确认，待编写实现计划
- 关联：在 MVP + 主题 + 管理端 CRUD + 记录视图之上扩展

## 1. 背景与目标

当前已评分任务只显示静态的「已评分 +N」，无法查看评分明细或纠错改分；`scoreTask` 对已评分任务直接抛「任务已评分」。同时 `/records` 把兑换历史与积分流水以内联长列表展示，占据页面。本次：

1. 让评分**可查看、可修改**（原地更新积分，余额自动校正）。
2. 把**兑换历史**与**积分流水**改为按钮触发的**弹窗**展示。

## 2. 修改评分（原地更新）

### 2.1 仓储层
`scoreTask(db, taskId, result)` 改为"可重复评分"（upsert 语义）：

- **首次评分**（任务 `status != 'scored'`）：维持现状——在事务内更新任务行（status='scored' + 结果字段 + points_awarded）并写一条正向积分流水（`task_instance_id = taskId`，reason=`完成任务: <模板名>`）。
- **再次评分**（任务已 `scored`）：在事务内
  - 重新用 `computePoints` 计算新得分；
  - 更新任务行的结果字段与 `points_awarded`；
  - **更新**那条关联积分流水（`WHERE task_instance_id = taskId`）的 `delta` 与 `reason`，**不新增**流水。
- 去掉原来的 `throw new Error("任务已评分")`。
- 余额由流水求和派生，更新后自动正确。

关联流水唯一性：评分写入的流水 `task_instance_id` 非空且每任务一条；兑换流水用 `reward_id` 而非 `task_instance_id`，故 `WHERE task_instance_id = ?` 精确命中该评分流水。

### 2.2 今日清单页（`/`）
- 已评分任务行：保留 `🎉 已评分 +N` 标识，并新增「查看/修改」按钮 → 展开评分表单。
- 评分表单预填该任务**已存储的值**：`actualMinutes`、`focused`、`usedScaffold`、`didCheck`、`errorCount`、`note`。`listTasks` 已返回这些字段，今日页直接传入表单。
- 保存即调用既有评分接口（现为 upsert），原地更新；进度条与得分随 `loadTasks` 刷新。

### 2.3 ScoreForm 组件
- 新增可选入参 `initial?: { actualMinutes; focused; usedScaffold; didCheck; errorCount; note }`。
- 有 `initial` 时用其初始化各受控状态；无则用现有默认值。
- 提交逻辑不变（POST `/api/tasks/[id]/score`）。

### 2.4 范围
- 今日页带日期选择器，可切到任意一天查看/改分——覆盖往日纠错需求。
- `/records` 的「按天回看任务」维持**只读**浏览，不在此处改分。

## 3. 兑换历史 / 积分流水弹窗

### 3.1 Modal 组件
- 新增轻量客户端组件 `app/_components/Modal.tsx`：固定遮罩层 + 居中卡片 + 标题 + 关闭按钮；点击遮罩或关闭按钮关闭。`open` 为 false 时不渲染。

### 3.2 `/records` 页
- 移除"兑换历史""积分流水"两个内联区块。
- 改为两个按钮：「查看兑换历史」「查看积分流水」。
- 各自点击打开一个 Modal，内部渲染对应列表（沿用现有 `redemptions`/`entries` 数据，按所选孩子加载；切换孩子时数据更新）。
- 「按天回看任务」区块保持内联不变。

## 4. 架构与接口

- 仓储：仅改 `lib/repositories/tasks.ts` 的 `scoreTask`（加再评分分支）。其余仓储、API 端点（`POST /api/tasks/[id]/score`、`GET .../redemptions`、`GET .../entries`）签名不变。
- UI：
  - `app/_components/ScoreForm.tsx` 加 `initial` 入参与预填。
  - `app/page.tsx` 已评分任务加「查看/修改」入口并传入 initial。
  - `app/_components/Modal.tsx` 新建。
  - `app/records/page.tsx` 两区块改按钮 + 弹窗。
- 沿用童趣主题共享类（`.btn`、`.card`、`.chip`、`.input`）。

## 5. 约束与测试

- 不引入新依赖；不改数据库 schema。
- TDD（仓储）：再评分更新任务得分与余额、且评分流水**条数不变**（仅 delta/reason 变）；首次评分行为不回归。
- 既有「不能重复评分」测试改为断言"重评后得分/余额被更新、流水不新增"。
- UI 以 `npx next build` 通过 + 浏览器截图验证（查看/修改回填正确、改分后进度与得分更新；两个弹窗正常开关与展示）。
- 既有其余测试保持通过。

## 6. 不做（YAGNI）

- 不在奖励商店余额处加流水入口（仅 `/records` 触发弹窗）。
- 不做评分历史版本留痕（原地更新，不保留旧值轨迹）。
- 周报/规则引擎/AI/养成等后续里程碑不在此范围。
