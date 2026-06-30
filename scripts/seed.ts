import { getDb } from "../lib/db";
import { createChild, listChildren } from "../lib/repositories/children";
import { createTemplate, listTemplates } from "../lib/repositories/templates";
import { createReward, listRewards } from "../lib/repositories/rewards";

const db = getDb();

if (listChildren(db).length === 0) {
  createChild(db, { name: "老大", grade: 2, avatar: "🐯" });
  createChild(db, { name: "老二", grade: 1, avatar: "🐰" });
}

if (listTemplates(db).length === 0) {
  createTemplate(db, { name: "认真写 5 个字（专注番茄钟）", subject: "writing", defaultMinutes: 5, basePoints: 10 });
  createTemplate(db, { name: "看图写话：谁/在哪/做什么/怎么样/心情", subject: "picture_composition", defaultMinutes: 10, basePoints: 12 });
  createTemplate(db, { name: "口算 10 题（做完检查）", subject: "math", defaultMinutes: 8, basePoints: 10 });
}

if (listRewards(db).length === 0) {
  createReward(db, { name: "看动画 30 分钟", cost: 30 });
  createReward(db, { name: "选一次周末活动", cost: 80 });
  createReward(db, { name: "买一本想要的书", cost: 120 });
}

console.log("seed done:", {
  children: listChildren(db).length,
  templates: listTemplates(db).length,
  rewards: listRewards(db).length,
});
