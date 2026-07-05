"use client";
import { useEffect, useState } from "react";
import { SUBJECT_META } from "../_components/subjectMeta";

const SUBJECTS = [
  { value: "writing", label: "写字" },
  { value: "picture_composition", label: "看图写话" },
  { value: "math", label: "数学" },
  { value: "other", label: "其他" },
];

const TABS = [
  { key: "children", label: "孩子" },
  { key: "tasks", label: "任务" },
  { key: "rewards", label: "奖励" },
  { key: "stars", label: "星星" },
  { key: "scoring", label: "评分" },
  { key: "archived", label: "已归档" },
] as const;

const ADJUST_REASONS = ["主动帮忙", "表现优秀", "主动学习", "违反约定", "未完成任务", "闹脾气"];

interface ChildRow { id: number; name: string; grade: number; avatar: string; archived: number }
interface TplRow { id: number; name: string; subject: string; defaultMinutes: number; basePoints: number; archived: number }
interface RewardRow { id: number; name: string; cost: number; active: number }
interface BonusRow { id: number; name: string; description: string; points: number; active: number; sortOrder: number }

export default function Manage() {
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [templates, setTemplates] = useState<TplRow[]>([]);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [bonusItems, setBonusItems] = useState<BonusRow[]>([]);
  const [settings, setSettings] = useState<{ onTimeBonus: number; errorPenalty: number; minPoints: number }>({ onTimeBonus: 3, errorPenalty: 2, minPoints: 1 });
  // create inputs
  const [cName, setCName] = useState(""); const [cGrade, setCGrade] = useState(1);
  const [tName, setTName] = useState(""); const [tSubject, setTSubject] = useState("writing");
  const [tMinutes, setTMinutes] = useState(5); const [tPoints, setTPoints] = useState(10);
  const [rName, setRName] = useState(""); const [rCost, setRCost] = useState(30);
  // edit state: which row id is being edited per entity
  const [editChild, setEditChild] = useState<ChildRow | null>(null);
  const [editTpl, setEditTpl] = useState<TplRow | null>(null);
  const [editReward, setEditReward] = useState<RewardRow | null>(null);
  const [editBonus, setEditBonus] = useState<BonusRow | null>(null);
  const [bName, setBName] = useState(""); const [bDesc, setBDesc] = useState(""); const [bPoints, setBPoints] = useState(5);
  const [plans, setPlans] = useState<Record<number, number[]>>({});
  const [tab, setTab] = useState<"children" | "tasks" | "rewards" | "stars" | "scoring" | "archived">("children");
  // 手动增/扣星星
  const [adjChildId, setAdjChildId] = useState<number | null>(null);
  const [adjSign, setAdjSign] = useState<1 | -1>(1);
  const [adjAmount, setAdjAmount] = useState(5);
  const [adjReason, setAdjReason] = useState("");
  const [adjBalance, setAdjBalance] = useState<number | null>(null);
  const [adjBusy, setAdjBusy] = useState(false);

  function reload() {
    fetch("/api/children?all=1").then((r) => r.json()).then(setChildren);
    fetch("/api/templates?all=1").then((r) => r.json()).then(setTemplates);
    fetch("/api/rewards?all=1").then((r) => r.json()).then(setRewards);
    fetch("/api/bonus-items?all=1").then((r) => r.json()).then(setBonusItems);
    fetch("/api/scoring-settings").then((r) => r.json()).then(setSettings);
    fetch("/api/children?all=1").then((r) => r.json()).then((cs: ChildRow[]) => {
      cs.filter((c) => c.archived === 0).forEach((c) => {
        fetch(`/api/children/${c.id}/daily-plan`).then((r) => r.json()).then((ids: number[]) =>
          setPlans((p) => ({ ...p, [c.id]: ids })),
        );
      });
    });
  }
  useEffect(reload, []);

  async function addChild() {
    await fetch("/api/children", { method: "POST", body: JSON.stringify({ name: cName, grade: cGrade }) });
    setCName(""); reload();
  }
  async function saveChild() {
    if (!editChild) return;
    await fetch(`/api/children/${editChild.id}`, { method: "PATCH", body: JSON.stringify(editChild) });
    setEditChild(null); reload();
  }
  async function addTemplate() {
    await fetch("/api/templates", { method: "POST", body: JSON.stringify({ name: tName, subject: tSubject, defaultMinutes: tMinutes, basePoints: tPoints }) });
    setTName(""); reload();
  }
  async function saveTpl() {
    if (!editTpl) return;
    await fetch(`/api/templates/${editTpl.id}`, { method: "PATCH", body: JSON.stringify(editTpl) });
    setEditTpl(null); reload();
  }
  async function addReward() {
    await fetch("/api/rewards", { method: "POST", body: JSON.stringify({ name: rName, cost: rCost }) });
    setRName(""); reload();
  }
  async function saveReward() {
    if (!editReward) return;
    await fetch(`/api/rewards/${editReward.id}`, { method: "PATCH", body: JSON.stringify(editReward) });
    setEditReward(null); reload();
  }
  async function addBonus() {
    await fetch("/api/bonus-items", { method: "POST", body: JSON.stringify({ name: bName, description: bDesc, points: bPoints, sortOrder: activeBonus.length }) });
    setBName(""); setBDesc(""); reload();
  }
  async function saveBonus() {
    if (!editBonus) return;
    await fetch(`/api/bonus-items/${editBonus.id}`, { method: "PATCH", body: JSON.stringify(editBonus) });
    setEditBonus(null); reload();
  }
  async function saveSettings() {
    const s = await fetch("/api/scoring-settings", { method: "PATCH", body: JSON.stringify(settings) }).then((r) => r.json());
    setSettings(s);
    alert("评分设置已保存");
  }
  async function toggle(kind: string, id: number, action: "archive" | "restore") {
    await fetch(`/api/${kind}/${id}/${action}`, { method: "POST" });
    reload();
  }
  async function togglePlan(childId: number, templateId: number, on: boolean) {
    await fetch(`/api/children/${childId}/daily-plan`, {
      method: on ? "POST" : "DELETE",
      body: JSON.stringify({ templateId }),
    });
    setPlans((p) => {
      const cur = p[childId] ?? [];
      return { ...p, [childId]: on ? [...cur, templateId] : cur.filter((x) => x !== templateId) };
    });
  }

  const activeChildren = children.filter((c) => c.archived === 0);
  const archivedChildren = children.filter((c) => c.archived === 1);
  const activeTpls = templates.filter((t) => t.archived === 0);
  const archivedTpls = templates.filter((t) => t.archived === 1);
  const activeRewards = rewards.filter((r) => r.active === 1);
  const archivedRewards = rewards.filter((r) => r.active === 0);
  const activeBonus = bonusItems.filter((b) => b.active === 1);
  const archivedBonus = bonusItems.filter((b) => b.active === 0);

  // 星星 Tab：默认选中第一个孩子
  useEffect(() => {
    if (adjChildId === null && activeChildren[0]) setAdjChildId(activeChildren[0].id);
  }, [activeChildren, adjChildId]);
  // 加载所选孩子的余额
  useEffect(() => {
    if (adjChildId === null) { setAdjBalance(null); return; }
    fetch(`/api/children/${adjChildId}/balance`).then((r) => r.json()).then((b) => setAdjBalance(b.balance));
  }, [adjChildId]);

  async function submitAdjust() {
    if (adjChildId === null) return;
    const reason = adjReason.trim();
    if (!reason) { alert("请填写原因"); return; }
    if (!adjAmount || adjAmount <= 0) { alert("请填写正整数星星数量"); return; }
    setAdjBusy(true);
    const res = await fetch(`/api/children/${adjChildId}/adjust`, {
      method: "POST",
      body: JSON.stringify({ delta: adjSign * adjAmount, reason }),
    });
    setAdjBusy(false);
    if (!res.ok) { alert((await res.json()).error); return; }
    const data = await res.json();
    setAdjBalance(data.balance);
    setAdjReason("");
    alert(`已${adjSign > 0 ? "奖励" : "扣减"} ${adjAmount}⭐，当前余额 ${data.balance}⭐`);
  }

  return (
    <div className="space-y-8">
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

      {/* 孩子 */}
      {tab === "children" && (
      <section>
        <h2 className="mb-2 font-semibold">孩子</h2>
        <ul className="mb-2 space-y-1">
          {activeChildren.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              {editChild?.id === c.id ? (
                <>
                  <input className="input w-28" value={editChild.name} onChange={(e) => setEditChild({ ...editChild, name: e.target.value })} />
                  <input type="number" className="input w-16" value={editChild.grade} onChange={(e) => setEditChild({ ...editChild, grade: +e.target.value })} />
                  <input className="input w-16" value={editChild.avatar} onChange={(e) => setEditChild({ ...editChild, avatar: e.target.value })} />
                  <button className="btn btn-emerald px-3 py-1 text-sm" onClick={saveChild}>保存</button>
                  <button className="text-sm text-slate-500" onClick={() => setEditChild(null)}>取消</button>
                </>
              ) : (
                <>
                  <span className="flex-1">{c.avatar} {c.name}（{c.grade} 年级）</span>
                  <span className="flex shrink-0 gap-2">
                    <button className="text-sm text-sky-600" onClick={() => setEditChild(c)}>编辑</button>
                    <button className="text-sm text-rose-500" onClick={() => toggle("children", c.id, "archive")}>归档</button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input placeholder="姓名" value={cName} onChange={(e) => setCName(e.target.value)} className="input" />
          <input type="number" value={cGrade} onChange={(e) => setCGrade(+e.target.value)} className="input w-16" />
          <button onClick={addChild} className="btn btn-primary px-3 py-1">添加</button>
        </div>
      </section>
      )}

      {/* 任务模板 */}
      {tab === "tasks" && (
      <section>
        <h2 className="mb-2 font-semibold">任务模板</h2>
        <ul className="mb-2 space-y-1">
          {activeTpls.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2">
              {editTpl?.id === t.id ? (
                <>
                  <input className="input w-40" value={editTpl.name} onChange={(e) => setEditTpl({ ...editTpl, name: e.target.value })} />
                  <select className="input" value={editTpl.subject} onChange={(e) => setEditTpl({ ...editTpl, subject: e.target.value })}>
                    {SUBJECTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <input type="number" className="input w-16" value={editTpl.defaultMinutes} onChange={(e) => setEditTpl({ ...editTpl, defaultMinutes: +e.target.value })} />
                  <input type="number" className="input w-16" value={editTpl.basePoints} onChange={(e) => setEditTpl({ ...editTpl, basePoints: +e.target.value })} />
                  <button className="btn btn-emerald px-3 py-1 text-sm" onClick={saveTpl}>保存</button>
                  <button className="text-sm text-slate-500" onClick={() => setEditTpl(null)}>取消</button>
                </>
              ) : (
                <>
                  <span className="flex flex-1 items-center gap-2">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${SUBJECT_META[t.subject as keyof typeof SUBJECT_META]?.dot ?? "bg-slate-300"}`} />
                    <span>{t.name}（{t.basePoints}分 / {t.defaultMinutes}分钟）</span>
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <button className="text-sm text-sky-600" onClick={() => setEditTpl(t)}>编辑</button>
                    <button className="text-sm text-rose-500" onClick={() => toggle("templates", t.id, "archive")}>归档</button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <input placeholder="任务名" value={tName} onChange={(e) => setTName(e.target.value)} className="input" />
          <select value={tSubject} onChange={(e) => setTSubject(e.target.value)} className="input">
            {SUBJECTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="number" value={tMinutes} onChange={(e) => setTMinutes(+e.target.value)} className="input w-20" placeholder="分钟" />
          <input type="number" value={tPoints} onChange={(e) => setTPoints(+e.target.value)} className="input w-20" placeholder="基础分" />
          <button onClick={addTemplate} className="btn btn-primary px-3 py-1">添加</button>
        </div>
      </section>
      )}

      {/* 奖励 */}
      {tab === "rewards" && (
      <section>
        <h2 className="mb-2 font-semibold">奖励</h2>
        <ul className="mb-2 space-y-1">
          {activeRewards.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2">
              {editReward?.id === r.id ? (
                <>
                  <input className="input w-40" value={editReward.name} onChange={(e) => setEditReward({ ...editReward, name: e.target.value })} />
                  <input type="number" className="input w-20" value={editReward.cost} onChange={(e) => setEditReward({ ...editReward, cost: +e.target.value })} />
                  <button className="btn btn-emerald px-3 py-1 text-sm" onClick={saveReward}>保存</button>
                  <button className="text-sm text-slate-500" onClick={() => setEditReward(null)}>取消</button>
                </>
              ) : (
                <>
                  <span className="flex-1">{r.name}（{r.cost} 分）</span>
                  <span className="flex shrink-0 gap-2">
                    <button className="text-sm text-sky-600" onClick={() => setEditReward(r)}>编辑</button>
                    <button className="text-sm text-rose-500" onClick={() => toggle("rewards", r.id, "archive")}>归档</button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input placeholder="奖励名" value={rName} onChange={(e) => setRName(e.target.value)} className="input" />
          <input type="number" value={rCost} onChange={(e) => setRCost(+e.target.value)} className="input w-24" />
          <button onClick={addReward} className="btn btn-primary px-3 py-1">新增奖励</button>
        </div>
      </section>
      )}

      {/* 星星：手动增/扣 */}
      {tab === "stars" && (
      <section>
        <h2 className="mb-2 font-semibold">手动增 / 扣星星</h2>
        <p className="mb-3 text-sm text-slate-500">用于临时奖励或扣减，会记入孩子的积分流水。</p>
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={adjChildId ?? ""} onChange={(e) => setAdjChildId(+e.target.value)} className="input">
              {activeChildren.map((c) => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
            </select>
            <span className="balance-badge">⭐ {adjBalance ?? "…"}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setAdjSign(1)}
              className={`flex-1 rounded-xl py-2 font-semibold ${adjSign === 1 ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-700"}`}
            >
              ＋ 奖励
            </button>
            <button
              onClick={() => setAdjSign(-1)}
              className={`flex-1 rounded-xl py-2 font-semibold ${adjSign === -1 ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-700"}`}
            >
              － 扣减
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">星星数量</span>
            <button onClick={() => setAdjAmount((n) => Math.max(1, n - 1))} className="btn btn-sky h-9 w-9 p-0 text-lg">－</button>
            <input
              type="number"
              min={1}
              value={adjAmount}
              onChange={(e) => setAdjAmount(Math.max(1, Math.trunc(+e.target.value) || 1))}
              className="input w-20 text-center"
            />
            <button onClick={() => setAdjAmount((n) => n + 1)} className="btn btn-sky h-9 w-9 p-0 text-lg">＋</button>
          </div>

          <div>
            <div className="mb-1 text-sm text-slate-600">原因（点选常用或自行填写）</div>
            <div className="mb-2 flex flex-wrap gap-2">
              {ADJUST_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setAdjReason(r)}
                  className={`chip ${adjReason === r ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700"}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              placeholder="自定义原因…"
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              className="input w-full"
            />
          </div>

          <button
            onClick={submitAdjust}
            disabled={adjBusy}
            className={`btn w-full py-2.5 ${adjSign > 0 ? "btn-emerald" : "btn-rose"}`}
          >
            {adjBusy ? "提交中…" : adjSign > 0 ? `确认奖励 ${adjAmount}⭐` : `确认扣减 ${adjAmount}⭐`}
          </button>
        </div>
      </section>
      )}

      {/* 每日计划 */}
      {tab === "tasks" && (
      <section>
        <h2 className="mb-2 font-semibold">每日计划（打开应用自动派发当天）</h2>
        {activeChildren.map((c) => (
          <div key={c.id} className="card mb-2">
            <div className="mb-1 font-medium">{c.avatar} {c.name}</div>
            <div className="flex flex-wrap gap-3">
              {activeTpls.map((t) => {
                const on = (plans[c.id] ?? []).includes(t.id);
                return (
                  <label key={t.id} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={on} onChange={(e) => togglePlan(c.id, t.id, e.target.checked)} />
                    {t.name}
                  </label>
                );
              })}
              {activeTpls.length === 0 && <span className="text-slate-500 text-sm">先在上面添加任务模板</span>}
            </div>
          </div>
        ))}
      </section>
      )}

      {/* 加分项 */}
      {tab === "scoring" && (
      <section>
        <h2 className="mb-2 font-semibold">加分项（评分时可勾选）</h2>
        <ul className="mb-2 space-y-1">
          {activeBonus.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2">
              {editBonus?.id === b.id ? (
                <>
                  <input className="input w-28" value={editBonus.name} onChange={(e) => setEditBonus({ ...editBonus, name: e.target.value })} />
                  <input className="input flex-1" value={editBonus.description} onChange={(e) => setEditBonus({ ...editBonus, description: e.target.value })} />
                  <input type="number" className="input w-16" value={editBonus.points} onChange={(e) => setEditBonus({ ...editBonus, points: +e.target.value })} />
                  <button className="btn btn-emerald px-3 py-1 text-sm" onClick={saveBonus}>保存</button>
                  <button className="text-sm text-slate-500" onClick={() => setEditBonus(null)}>取消</button>
                </>
              ) : (
                <>
                  <span className="flex-1">{b.name} <span className="text-amber-600">+{b.points}</span> <span className="text-xs text-slate-500">{b.description}</span></span>
                  <span className="flex shrink-0 gap-2">
                    <button className="text-sm text-sky-600" onClick={() => setEditBonus(b)}>编辑</button>
                    <button className="text-sm text-rose-500" onClick={() => toggle("bonus-items", b.id, "archive")}>归档</button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <input placeholder="名称" value={bName} onChange={(e) => setBName(e.target.value)} className="input w-28" />
          <input placeholder="说明" value={bDesc} onChange={(e) => setBDesc(e.target.value)} className="input flex-1" />
          <input type="number" value={bPoints} onChange={(e) => setBPoints(+e.target.value)} className="input w-16" placeholder="分值" />
          <button onClick={addBonus} className="btn btn-primary px-3 py-1">添加</button>
        </div>
      </section>
      )}

      {/* 评分设置 */}
      {tab === "scoring" && (
      <section>
        <h2 className="mb-2 font-semibold">评分设置</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1">按时加分
            <input type="number" className="input w-16" value={settings.onTimeBonus} onChange={(e) => setSettings({ ...settings, onTimeBonus: +e.target.value })} />
          </label>
          <label className="flex items-center gap-1">错题扣分
            <input type="number" className="input w-16" value={settings.errorPenalty} onChange={(e) => setSettings({ ...settings, errorPenalty: +e.target.value })} />
          </label>
          <label className="flex items-center gap-1">最低分
            <input type="number" className="input w-16" value={settings.minPoints} onChange={(e) => setSettings({ ...settings, minPoints: +e.target.value })} />
          </label>
          <button onClick={saveSettings} className="btn btn-primary px-3 py-1">保存</button>
        </div>
        <p className="mt-1 text-xs text-slate-500">得分 = 基础分 + 已勾选加分项 + 按时加分（用时≤模板时长）− 错题数×错题扣分，最低不低于最低分。</p>
      </section>
      )}

      {/* 已归档 */}
      {tab === "archived" && (
      <section>
        <h2 className="mb-2 font-semibold text-slate-500">已归档</h2>
        <ul className="space-y-1 text-sm text-slate-500">
          {archivedChildren.map((c) => (
            <li key={`c${c.id}`} className="flex items-center gap-2">
              <span>👶 {c.avatar} {c.name}</span>
              <button className="text-emerald-600" onClick={() => toggle("children", c.id, "restore")}>恢复</button>
            </li>
          ))}
          {archivedTpls.map((t) => (
            <li key={`t${t.id}`} className="flex items-center gap-2">
              <span>📝 {t.name}</span>
              <button className="text-emerald-600" onClick={() => toggle("templates", t.id, "restore")}>恢复</button>
            </li>
          ))}
          {archivedRewards.map((r) => (
            <li key={`r${r.id}`} className="flex items-center gap-2">
              <span>🎁 {r.name}</span>
              <button className="text-emerald-600" onClick={() => toggle("rewards", r.id, "restore")}>恢复</button>
            </li>
          ))}
          {archivedBonus.map((b) => (
            <li key={`b${b.id}`} className="flex items-center gap-2">
              <span>⭐ {b.name}</span>
              <button className="text-emerald-600" onClick={() => toggle("bonus-items", b.id, "restore")}>恢复</button>
            </li>
          ))}
          {archivedChildren.length + archivedTpls.length + archivedRewards.length + archivedBonus.length === 0 && <li>（暂无已归档项）</li>}
        </ul>
      </section>
      )}
    </div>
  );
}
