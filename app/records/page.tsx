"use client";
import { useEffect, useState } from "react";
import { Modal } from "../_components/Modal";
import { shiftDate, todayStr } from "../_components/dateNav";

interface Child { id: number; name: string; avatar: string }
interface Template { id: number; name: string }
interface Task { id: number; templateId: number; status: string; pointsAwarded: number | null; startedAt: string | null; completedAt: string | null; scoredAt: string | null; bonusItemIds: number[]; note: string | null }
interface Entry { id: number; delta: number; reason: string; createdAt: string }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(ts: string) {
  // 后端存的是 UTC(ISO)，按本地时区显示为 MM-DD HH:mm
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts.slice(5, 16).replace("T", " ");
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Records() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [redemptions, setRedemptions] = useState<Entry[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showRedemptions, setShowRedemptions] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [bonusNames, setBonusNames] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch("/api/children").then((r) => r.json()).then((c: Child[]) => {
      setChildren(c);
      if (c[0]) setChildId(c[0].id);
    });
    fetch("/api/templates?all=1").then((r) => r.json()).then(setTemplates);
    fetch("/api/bonus-items?all=1").then((r) => r.json()).then((items: { id: number; name: string }[]) => {
      const map: Record<number, string> = {};
      items.forEach((it) => { map[it.id] = it.name; });
      setBonusNames(map);
    });
  }, []);

  useEffect(() => {
    if (!childId) return;
    fetch(`/api/tasks?childId=${childId}&date=${date}`).then((r) => r.json()).then(setTasks);
  }, [childId, date]);

  useEffect(() => {
    if (!childId) return;
    fetch(`/api/children/${childId}/redemptions`).then((r) => r.json()).then(setRedemptions);
    fetch(`/api/children/${childId}/entries`).then((r) => r.json()).then(setEntries);
  }, [childId]);

  const tplName = (id: number) => templates.find((t) => t.id === id)?.name ?? "?";

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <select value={childId ?? ""} onChange={(e) => setChildId(+e.target.value)} className="input">
          {children.map((c) => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
        </select>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">按天回看任务</h2>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          <div className="flex gap-1">
            <button onClick={() => setDate(shiftDate(date, -1))} className="btn btn-sky px-3 py-1.5 text-sm">前一天</button>
            <button onClick={() => setDate(todayStr())} className="btn btn-primary px-3 py-1.5 text-sm">今天</button>
            <button onClick={() => setDate(shiftDate(date, 1))} className="btn btn-sky px-3 py-1.5 text-sm">后一天</button>
          </div>
        </div>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="card">
              <div className="flex items-center justify-between">
                <span>{tplName(t.templateId)}</span>
                {t.status === "scored"
                  ? <span className="chip bg-emerald-100 text-emerald-700">已评分 +{t.pointsAwarded}</span>
                  : <span className="chip bg-slate-100 text-slate-500">{t.status === "done" ? "待评分" : t.status === "in_progress" ? "进行中" : "未开始"}</span>}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                开始 {t.startedAt ? fmt(t.startedAt) : "—"} · 完成 {t.completedAt ? fmt(t.completedAt) : "—"} · 评分 {t.scoredAt ? fmt(t.scoredAt) : "—"}
              </div>
              {t.bonusItemIds.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {t.bonusItemIds.map((bid) => (
                    <span key={bid} className="chip bg-violet-100 text-violet-700">{bonusNames[bid] ?? "加分项"}</span>
                  ))}
                </div>
              )}
              {t.note && <div className="mt-1 text-xs text-slate-600">备注：{t.note}</div>}
            </li>
          ))}
          {tasks.length === 0 && <li className="text-slate-500">这一天没有任务。</li>}
        </ul>
      </section>

      <div className="flex gap-3">
        <button className="btn btn-sky px-3 py-1" onClick={() => setShowRedemptions(true)}>查看兑换历史</button>
        <button className="btn btn-primary px-3 py-1" onClick={() => setShowLedger(true)}>查看积分流水</button>
      </div>

      <Modal open={showRedemptions} title="兑换历史" onClose={() => setShowRedemptions(false)}>
        <ul className="space-y-2">
          {redemptions.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <span className="min-w-0 flex-1">{e.reason}</span>
              <span className="flex shrink-0 flex-col items-end text-right">
                <span className="whitespace-nowrap font-semibold text-rose-500">{e.delta}⭐</span>
                <span className="whitespace-nowrap text-xs text-slate-400">{fmt(e.createdAt)}</span>
              </span>
            </li>
          ))}
          {redemptions.length === 0 && <li className="text-slate-500">还没有兑换记录。</li>}
        </ul>
      </Modal>

      <Modal open={showLedger} title="积分流水" onClose={() => setShowLedger(false)}>
        <ul className="space-y-1 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <span className="min-w-0 flex-1">{e.reason}</span>
              <span className="flex shrink-0 flex-col items-end text-right">
                <span className={`whitespace-nowrap font-semibold ${e.delta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                  {e.delta >= 0 ? `+${e.delta}` : e.delta}⭐
                </span>
                <span className="whitespace-nowrap text-xs text-slate-400">{fmt(e.createdAt)}</span>
              </span>
            </li>
          ))}
          {entries.length === 0 && <li className="text-slate-500">还没有积分记录。</li>}
        </ul>
      </Modal>
    </div>
  );
}
