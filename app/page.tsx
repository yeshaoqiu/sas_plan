"use client";
import { useEffect, useState } from "react";
import { ScoreForm } from "./_components/ScoreForm";

interface Child { id: number; name: string; avatar: string }
interface Template { id: number; name: string; subject: string }
interface Task { id: number; templateId: number; status: string; pointsAwarded: number | null }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Home() {
  const [children, setChildren] = useState<Child[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [scoring, setScoring] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/children").then((r) => r.json()).then((c) => {
      setChildren(c);
      if (c[0]) setChildId(c[0].id);
    });
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
  }, []);

  async function loadTasks() {
    if (!childId) return;
    const t = await fetch(`/api/tasks?childId=${childId}&date=${date}`).then((r) => r.json());
    setTasks(t);
  }
  useEffect(() => { loadTasks(); }, [childId, date]);

  async function assign(templateId: number) {
    await fetch("/api/tasks", { method: "POST", body: JSON.stringify({ childId, templateId, date }) });
    loadTasks();
  }

  const tplName = (id: number) => templates.find((t) => t.id === id)?.name ?? "?";

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={childId ?? ""} onChange={(e) => setChildId(+e.target.value)} className="rounded border px-2 py-1">
          {children.map((c) => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border px-2 py-1" />
      </div>

      <div>
        <h2 className="mb-2 font-semibold">派发任务</h2>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <button key={t.id} onClick={() => assign(t.id)} className="rounded bg-sky-500 px-3 py-1 text-sm text-white">+ {t.name}</button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">今日任务</h2>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="rounded bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span>{tplName(t.templateId)}</span>
                {t.status === "scored"
                  ? <span className="text-emerald-600">已评分 +{t.pointsAwarded}</span>
                  : <button onClick={() => setScoring(scoring === t.id ? null : t.id)} className="rounded bg-amber-500 px-2 py-1 text-sm text-white">评分</button>}
              </div>
              {scoring === t.id && <ScoreForm taskId={t.id} onDone={() => { setScoring(null); loadTasks(); }} />}
            </li>
          ))}
          {tasks.length === 0 && <li className="text-slate-500">还没有任务，点上面派发。</li>}
        </ul>
      </div>
    </div>
  );
}
