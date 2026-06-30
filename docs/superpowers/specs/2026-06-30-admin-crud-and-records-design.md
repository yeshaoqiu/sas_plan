# 管理端 CRUD + 记录/进度视图 — 设计文档

- 日期：2026-06-30
- 状态：已确认，待编写实现计划
- 关联：在 MVP（里程碑 1）+ 视觉主题之上扩展；可视为里程碑 2 的一部分（管理与记录）

## 1. 背景与目标

MVP 的管理页只支持孩子/任务模板/奖励的「增 + 查」，无法编辑或删除；历史数据虽已记录（任务实例、积分流水、兑换流水），但缺少回看与统计视图。本次补齐：

1. 管理端对孩子、任务模板、奖励的完整 CRUD（含安全删除）。
2. 记录/进度视图：按天回看任务、当日完成进度、兑换历史、积分流水。

## 2. 删除语义：软删除 / 归档

直接物理删除会破坏外键、丢失历史，故采用**软删除（归档）**：

- `children`、`task_templates` 各新增列 `archived INTEGER NOT NULL DEFAULT 0`。
- `rewards` 复用已有的 `active` 列（`active = 0` 即归档）。
- 归档项从所有「活跃列表」隐藏：
  - 今日清单派发任务用的孩子下拉、任务模板按钮：只列未归档。
  - 奖励商店：只列 `active = 1`（现状已如此）。
- 历史数据原样保留：已派发的任务实例、积分流水、兑换记录不受归档影响。
- 可恢复：管理页提供「已归档」区与「恢复」操作，避免归档数据成为死角。

## 3. 编辑语义

- 可编辑字段：
  - 孩子：`name`、`grade`、`avatar`。
  - 任务模板：`name`、`subject`、`defaultMinutes`、`basePoints`。
  - 奖励：`name`、`cost`。
- 编辑模板的 `basePoints` 等只影响**之后**派发并评分的任务；已评分任务的 `pointsAwarded` 不变（计分在评分那一刻已落库，不回溯）。

## 4. 管理页（/manage）→ 完整 CRUD

三类实体统一支持 增 / 查 / 改 / 归档 / 恢复：

- **孩子**：行内「编辑」就地表单（姓名/年级/头像）+「归档」。
- **任务模板**：行内编辑（名称/科目/默认时长/基础分）+「归档」。
- **奖励**：行内编辑（名称/积分）+「归档」。
- 列表默认显示活跃项；页面底部一个可展开的「已归档」区，列出各类已归档项，每项可「恢复」。

## 5. 记录 / 进度视图

### 5.1 今日清单页（/）顶部进度条
- 选定孩子的当天统计：「已完成 X/Y · 获得 N⭐」+ 进度条。
- 口径：X = 当天 `status='scored'` 的任务数；Y = 当天任务总数；N = 当天该孩子通过任务获得的积分之和（正向、来源任务的流水）。

### 5.2 新增「记录」页（/records），按孩子查看
- **按天回看任务**：选日期 → 当天派了哪些任务及其完成/评分情况（今日清单的只读往日版）。
- **兑换历史**：该孩子的兑换记录（`reward_id IS NOT NULL` 的流水），时间倒序，显示时间、奖励名、扣分。
- **积分流水**：该孩子全部加/扣/兑换明细（`listEntries`），时间倒序。

## 6. 架构与接口

### 6.1 仓储层（`lib/repositories/*`）
- `children.ts`：新增 `updateChild(db, id, input)`、`archiveChild(db, id)`、`restoreChild(db, id)`；`listChildren` 默认只返回未归档；新增 `listAllChildren`（含归档，供管理页归档区/恢复）。
- `templates.ts`：同上 `updateTemplate`/`archiveTemplate`/`restoreTemplate`；`listTemplates` 默认未归档；`listAllTemplates`。
- `rewards.ts`：新增 `updateReward`、`archiveReward`（置 `active=0`）、`restoreReward`（置 `active=1`）；`listRewards` 现状已过滤 `active=1`；新增 `listAllRewards`（含归档）。
- `points.ts`：新增 `listRedemptions(db, childId)`（`reward_id IS NOT NULL` 过滤，时间倒序）；`listEntries` 已存在（积分流水）。
- `tasks.ts`：新增当日进度查询 `getDayProgress(db, childId, date)` 返回 `{ total, scored, pointsEarned }`（`total`/`scored` 来自 `task_instances`，`pointsEarned` = 当天该孩子来源任务的正向流水之和）。前端不自行拼算，统一走此函数。

### 6.2 API（`app/api/**`）
- 孩子/模板/奖励：补 `PATCH`（编辑）、归档/恢复端点（如 `POST /api/children/[id]/archive`、`/restore`）。
- 记录：`GET /api/children/[id]/redemptions`（兑换历史）、`GET /api/children/[id]/entries`（积分流水）、`GET /api/children/[id]/progress?date=`（当日进度，调用 `getDayProgress`）。

### 6.3 UI（`app/**`）
- 扩展 `app/manage/page.tsx`：行内编辑、归档/恢复、已归档区。
- 新增 `app/records/page.tsx`：按孩子 + 三个区块（按天回看 / 兑换历史 / 积分流水）。
- `app/page.tsx`：顶部进度条。
- 顶栏导航增加「记录」链接。
- 沿用现有童趣主题共享类（`.card`/`.btn`/`.input`/`.chip` 等）。

## 7. 范围与拆分

实现时拆成**两个独立实现计划**，各自可跑通、可验证：

1. **管理端 CRUD（含归档/恢复）**：数据模型加列 + 仓储 update/archive/restore + 活跃列表过滤 + API + /manage UI。
2. **记录/进度视图**：兑换历史/积分流水查询 + 当日进度 + /records 页 + 今日页进度条 + 导航。

## 8. 约束与测试

- 不引入新依赖；沿用 Next.js + better-sqlite3 + Tailwind。
- 仓储层新增逻辑走 TDD：update 改值、archive/restore 切换、活跃列表过滤排除归档、兑换历史过滤、当日进度统计。
- UI 以 `npx next build` 通过 + 浏览器截图验证。
- 既有 16 项测试须保持通过；新增列对旧库通过 `ALTER TABLE ... ADD COLUMN ... DEFAULT 0` 或 `CREATE TABLE IF NOT EXISTS` + 迁移保证兼容（schema 用 `IF NOT EXISTS`，新列需迁移处理；实现计划中明确）。

## 9. 不做（YAGNI，留后续里程碑）

- 周报、规则引擎自动调计划、AI 总结、趋势图表、宠物/等级/排行榜。
