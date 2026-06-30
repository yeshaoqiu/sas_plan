"use client";
import { useEffect, useState } from "react";
import { Modal } from "../_components/Modal";

interface Child { id: number; name: string; avatar: string }
interface Template { id: number; name: string }
interface Task { id: number; templateId: number; status: string; pointsAwarded: number | null }
interface Entry { id: number; delta: number; reason: string; createdAt: string }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(ts: string) {
  return ts.slice(0, 16).replace("T", " ");
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

  useEffect(() => {
    fetch("/api/children").then((r) => r.json()).then((c: Child[]) => {
      setChildren(c);
      if (c[0]) setChildId(c[0].id);
    });
    fetch("/api/templates?all=1").then((r) => r.json()).then(setTemplates);
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
        <div className="mb-2 flex items-center gap-3">
          <h2 className="font-semibold">按天回看任务</h2>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="card flex items-center justify-between">
              <span>{tplName(t.templateId)}</span>
              {t.status === "scored"
                ? <span className="chip bg-emerald-100 text-emerald-700">已评分 +{t.pointsAwarded}</span>
                : <span className="chip bg-slate-100 text-slate-500">未完成</span>}
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
            <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <span>{e.reason}</span>
              <span className="whitespace-nowrap text-rose-500">{e.delta}⭐ · {fmt(e.createdAt)}</span>
            </li>
          ))}
          {redemptions.length === 0 && <li className="text-slate-500">还没有兑换记录。</li>}
        </ul>
      </Modal>

      <Modal open={showLedger} title="积分流水" onClose={() => setShowLedger(false)}>
        <ul className="space-y-1 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <span>{e.reason}</span>
              <span className={`whitespace-nowrap ${e.delta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                {e.delta >= 0 ? `+${e.delta}` : e.delta}⭐ · {fmt(e.createdAt)}
              </span>
            </li>
          ))}
          {entries.length === 0 && <li className="text-slate-500">还没有积分记录。</li>}
        </ul>
      </Modal>
    </div>
  );
}
