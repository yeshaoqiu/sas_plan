# 家庭学习陪跑系统

线下练、线上记的家庭学习陪跑应用。

## 运行

```bash
npm install
npm run seed   # 首次：初始化两个孩子、示例任务模板与奖励
npm run dev    # 启动，浏览器打开 http://localhost:3000
```

数据存放在本地 `data/app.db`（SQLite），不上传任何服务器。

## 页面
- `/`：今日清单 — 派发任务、录入结果与评分
- `/rewards`：奖励商店 — 查看积分余额、兑换奖励
- `/manage`：管理 — 新增孩子与任务模板

## 测试
```bash
npm test
```
