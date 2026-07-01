# 养成/等级系统（成长页）— 设计文档

- 日期：2026-07-01
- 状态：已确认，待编写实现计划
- 关联：原 spec 里程碑 3（养成/等级 + 连续打卡）

## 1. 背景与目标

给每个孩子一个"进化宠物"，随累计学习成长升级，并展示连续打卡，激励坚持。全部由现有数据派生，不加表、不改计分。

## 2. 成长数据（派生自现有 point_entries / task_instances）

- **累计获得** `cumulativeEarned`：该孩子 `point_entries` 中 `delta > 0` 之和（终身获得的正向积分；兑换奖励的负向流水**不**扣减）。→ 等级只涨不掉。
- **连续打卡** `streak`：从「今天」往回数、连续每天都有 ≥1 个 `status='scored'` 任务的天数。口径：
  - 锚点 = 今天有已评分任务则今天，否则昨天有则昨天，否则 streak = 0（今日未做给一天宽限，避免误伤）。
  - 从锚点起逐日回溯，连续有已评分任务则计数 +1，遇到空缺日停止。
  - 「今天」由前端传本地日期（`YYYY-MM-DD`），保证与本地时区一致且可测。

## 3. 进化宠物（emoji 阶段）

阈值表（按 `cumulativeEarned` 取最高满足的档）：

| 等级 | 累计获得 ≥ | emoji | 名称 |
|---|---|---|---|
| Lv.1 | 0 | 🥚 | 蛋 |
| Lv.2 | 30 | 🐣 | 破壳 |
| Lv.3 | 80 | 🐤 | 小鸡 |
| Lv.4 | 160 | 🐔 | 大公鸡 |
| Lv.5 | 280 | 🦚 | 孔雀 |
| Lv.6 | 450 | 🦅 | 雄鹰 |

纯函数 `getPetStage(earned: number)` 返回：
```ts
{
  level: number;      // 1-based（数组下标+1）
  emoji: string;
  name: string;
  curMin: number;     // 当前档阈值
  nextMin: number | null;  // 下一档阈值；满级为 null
  toNext: number;     // 距下一级还差多少（满级为 0）
}
```

## 4. 「成长」页（新增，导航加入口）

- 路由 `/growth`，客户端组件，顶部选孩子（默认第一个）。
- 展示：**大号宠物 emoji**（如 `text-6xl`）+ **Lv.N 阶段名**；**距下一级进度条**（`(earned - curMin) / (nextMin - curMin)`，满级显示"已满级"）；**🔥 连续 N 天**；**累计获得 M⭐**。
- 纯展示，无操作（孩子专属游戏化面板）。
- 导航栏加「成长」链接（`layout.tsx` 的 `Nav`）。

## 5. 架构与接口

- `lib/pet.ts`（新建）：`getPetStage`（纯函数 + `PET_STAGES` 阈值表）。
- `lib/repositories/points.ts`（修改）：加 `getLifetimeEarned(db, childId): number`（`SUM(delta) WHERE child_id=? AND delta > 0`，无正向记录返回 0）。
- `lib/repositories/growth.ts`（新建）：`getStreak(db, childId, today: string): number`（§2 口径；用字符串日期回溯，`prevDay` 用 UTC 解析 `YYYY-MM-DD` 减一天再格式化，确定性）。
- API `app/api/children/[id]/growth/route.ts`：`GET ?today=YYYY-MM-DD` → `{ earned, streak, pet: getPetStage(earned) }`（earned 来自 getLifetimeEarned，streak 来自 getStreak）。
- UI：`app/growth/page.tsx`（新建）+ `app/_components/Nav.tsx` 加「成长」。

## 6. 拆分与测试

- 一个实现计划，约 5 个任务：`getPetStage` 纯函数（TDD）→ `getLifetimeEarned`（TDD）→ `getStreak`（TDD）→ growth API（集成测试）→ 成长页 + 导航（build+截图）。
- 不引入新依赖；派生自现有数据，无新表/无迁移；纯函数与仓储走 TDD；页面以 `npx next build` + 浏览器截图验证；既有 55 项测试保持通过。

## 7. 不做（YAGNI）

- 连续打卡不自动加分、不设里程碑奖励（仅展示）。
- 不做宠物换肤/命名/多宠物；阈值表写死在 `lib/pet.ts`（暂不做可配置）。
- 兄弟排行榜/合作任务、周报、规则引擎、AI 属其它里程碑，不在此范围。
