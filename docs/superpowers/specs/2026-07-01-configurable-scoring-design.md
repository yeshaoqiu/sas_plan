# 可配置评分系统（自定义加分项 + 按时加分 + 明细说明）— 设计文档

- 日期：2026-07-01
- 状态：已确认，待编写实现计划
- 关联：重构现有写死的计分逻辑（`lib/scoring.ts` 常量 + `scoreTask` 固定三项）

## 1. 背景与目标

当前评分的三项加分（专注完成/用上支架/做了检查，各 +5）、错题扣分（-2）、最低分（1）都写死在 `lib/scoring.ts`，评分表单是三个固定勾选框，且用时（`actual_minutes`）只记录不计分。本次：

1. 加分项**数据表化、可增删改**（名称/说明/分值/启用/排序）。
2. **用时计入评分**：用时 ≤ 模板预设时长 → 自动加分（只奖不罚），分值可配。
3. 评分表单每项**显示说明**。
4. 顺带把**错题扣分/最低分**也做成可配（评分设置）。

## 2. 新计分模型

```
得分 = 基础分(模板 basePoints)
     + Σ(本次勾选的加分项 points)
     + 按时加分(用时 ≤ 模板 defaultMinutes 时取 on_time_bonus，否则 0)
     − 错题数 × error_penalty
最终 = max(min_points, 得分)
```

- 按时加分：`actualMinutes <= template.defaultMinutes` 时加 `on_time_bonus`。只奖不罚。
- 加分项分值取评分那一刻各项的 `points`（与积分流水/得分冻结语义一致）。

## 3. 数据模型（迁移）

- 新表 `bonus_items`：
  ```sql
  CREATE TABLE IF NOT EXISTS bonus_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    points INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  ```
  迁移时若表为空，**种入现有三项默认加分项**（各 +5，带说明文案）：
  - 专注完成：这次做题没分心、专注做完（尤其写字）。
  - 用上支架：看图写话用上了结构支架（谁/在哪/做什么/怎么样/心情）。
  - 做了检查：做完后做了复核/检查这一步。
- 新表 `task_bonus`（评分勾选记录，评分时先删后插该任务的行）：
  ```sql
  CREATE TABLE IF NOT EXISTS task_bonus (
    task_instance_id INTEGER NOT NULL REFERENCES task_instances(id),
    bonus_item_id INTEGER NOT NULL REFERENCES bonus_items(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_task_bonus ON task_bonus(task_instance_id, bonus_item_id);
  ```
- 新单例 `scoring_settings`（id=1 一行）：
  ```sql
  CREATE TABLE IF NOT EXISTS scoring_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    on_time_bonus INTEGER NOT NULL DEFAULT 3,
    error_penalty INTEGER NOT NULL DEFAULT 2,
    min_points INTEGER NOT NULL DEFAULT 1
  );
  ```
  迁移时若无行，插入默认 `(1, 3, 2, 1)`。
- `task_instances`：沿用 `actual_minutes`；旧列 `focused/used_scaffold/did_check` **保留但不再写入**（向后兼容：旧已评分任务 `points_awarded` 已冻结、不回改；编辑很久前的旧任务时加分项不会自动回勾——罕见，可接受）。

## 4. 计分引擎

- `lib/scoring.ts` 的 `computePoints` 重写为纯函数：
  ```ts
  computePoints(input: {
    basePoints: number;
    bonusPoints: number;      // Σ 已选加分项分值
    onTimeBonus: number;      // 达标则取 on_time_bonus，否则 0
    errorCount: number;
    errorPenalty: number;
    minPoints: number;
  }): number
  ```
  实现：`max(minPoints, basePoints + bonusPoints + onTimeBonus - errorCount*errorPenalty)`。旧的写死常量删除。
- `scoreTask` 重写（入参改为 `{ actualMinutes, bonusItemIds: number[], errorCount, note?, now? }`）：
  - 取模板 `basePoints`、`defaultMinutes`；取 `scoring_settings`。
  - `onTime = actualMinutes <= template.defaultMinutes`；`onTimeBonus = onTime ? settings.on_time_bonus : 0`。
  - `bonusPoints = Σ bonus_items.points where id in bonusItemIds`（按当前值）。
  - `points = computePoints(...)`。
  - 事务：更新任务行（status='scored'、actual_minutes、error_count、note、points_awarded、`scored_at=COALESCE(scored_at, now)`）；**先删后插** `task_bonus`（该任务选中项）；首评写正向积分流水 / 重评更新该流水（沿用现有 upsert）。
  - 不再写 `focused/used_scaffold/did_check`。

## 5. 仓储与接口

- 新增 `lib/repositories/bonusItems.ts`：`listBonusItems(db)`（仅 active=1，按 sort_order,id）、`listAllBonusItems(db)`（含归档）、`createBonusItem`、`updateBonusItem`（name/description/points/sort_order）、`archiveBonusItem`（active=0）、`restoreBonusItem`（active=1）。软删除（保留历史 task_bonus 引用），与 rewards 一致。
- 新增 `lib/repositories/scoringSettings.ts`：`getScoringSettings(db)`、`updateScoringSettings(db, {onTimeBonus, errorPenalty, minPoints})`。
- `lib/repositories/tasks.ts`：`scoreTask` 重写；`listTaskBonus(db, taskId): number[]`（该任务选中的 bonus_item_id，供表单回填与展示）。
- API：
  - `GET/POST /api/bonus-items`、`PATCH/DELETE(归档) /api/bonus-items/[id]`、restore。
  - `GET/PATCH /api/scoring-settings`。
  - `POST /api/tasks/[id]/score` 入参改为 `{ actualMinutes, bonusItemIds, errorCount, note }`。
  - 任务对象附带其 `bonusItemIds`（或单独 GET）供回填。

## 6. 界面

- **评分表单（ScoreForm）**：按**启用的加分项**动态渲染勾选框，每项旁显示 `description`；保留用时/错题/备注；提交选中的 `bonusItemIds`。回填：已评分任务加载其 `task_bonus`。
- **管理页新增两区**：
  - 「加分项」：CRUD（名称/说明/分值/启用/排序）+ 归档/恢复。
  - 「评分设置」：按时加分、错题扣分、最低分（编辑保存）。
- **记录/今日（可选轻量）**：已评分任务可显示获得的加分项名与是否按时。

## 7. 拆分（三个实现计划）

1. **数据模型 + 计分引擎**：`bonus_items`/`task_bonus`/`scoring_settings` 表 + 迁移种子、`computePoints` 重写、`scoreTask` 重写、`bonusItems`/`scoringSettings`/`listTaskBonus` 仓储、既有评分测试按新模型重写。
2. **管理端 UI + API**：加分项 CRUD、评分设置编辑，对应 API 与 /manage 两区。
3. **评分表单动态化 + 说明 + 展示**：ScoreForm 动态勾选 + 说明 + 回填；score API 入参切换；记录/今日展示加分项/按时。

先做计划 1（核心、风险最高），逐个推进。

## 8. 约束与测试

- 不引入新依赖；迁移幂等（缺表才建、空表才种子、无设置行才插默认）；`CREATE TABLE IF NOT EXISTS` 与 `runMigrations` 结合。
- 计分核心走 TDD：computePoints 各项组合、按时/超时、错题扣分、最低分下限；scoreTask 的加分项汇总/按时判定/task_bonus 先删后插/scored_at 保留/重评更新流水。
- 既有评分相关测试按新模型重写（旧的基于 focused/usedScaffold/didCheck 的断言替换为基于 bonusItemIds 的断言）。
- UI 以 `npx next build` 通过 + 浏览器截图验证。

## 9. 不做（YAGNI）

- 不做按孩子/按科目不同的加分项集合（加分项全局通用）。
- 不做区间用时加分（仅"按时即达标加分"）。
- 不回迁旧任务的 focused/used_scaffold/did_check 到 task_bonus。
- 周报/规则引擎/AI/养成/排行榜等后续里程碑不在此范围。
