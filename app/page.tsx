"use client";
import { useEffect, useState } from "react";
import { ScoreForm } from "./_components/ScoreForm";
import { SUBJECT_META } from "./_components/subjectMeta";
import type { Subject } from "@/lib/types";

interface Child { id: number; name: string; avatar: string }
interface Template { id: number; name: string; subject: Subject }
interface Task {
  id: number;
  templateId: number;
  status: string;
  pointsAwarded: number | null;
  actualMinutes: number | null;
  focused: number | null;
  usedScaffold: number | null;
  didCheck: number | null;
  errorCount: number | null;
  note: string | null;
}

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
  const [progress, setProgress] = useState<{ total: number; scored: number; pointsEarned: number }>({ total: 0, scored: 0, pointsEarned: 0 });

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
    const p = await fetch(`/api/children/${childId}/progress?date=${date}`).then((r) => r.json());
    setProgress(p);
  }
  useEffect(() => { loadTasks(); }, [childId, date]);

  async function assign(templateId: number) {
    const res = await fetch("/api/tasks", { method: "POST", body: JSON.stringify({ childId, templateId, date }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    loadTasks();
  }

  const tplName = (id: number) => templates.find((t) => t.id === id)?.name ?? "?";
  const tplSubject = (id: number) => templates.find((t) => t.id === id)?.subject;
  const initialFor = (t: Task) => ({
    actualMinutes: t.actualMinutes ?? 5,
    focused: !!t.focused,
    usedScaffold: !!t.usedScaffold,
    didCheck: !!t.didCheck,
    errorCount: t.errorCount ?? 0,
    note: t.note ?? "",
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={childId ?? ""} onChange={(e) => setChildId(+e.target.value)} className="input">
          {children.map((c) => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
      </div>

      <div className="card">
        <div className="mb-1 flex items-center justify-between text-sm font-medium">
          <span>当日进度</span>
          <span className="text-amber-600">已完成 {progress.scored}/{progress.total} · 获得 {progress.pointsEarned}⭐</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-amber-100">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${progress.total ? Math.round((progress.scored / progress.total) * 100) : 0}%` }}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">派发任务</h2>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <button key={t.id} onClick={() => assign(t.id)} className="btn btn-sky px-3 py-1 text-sm">+ {t.name}</button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">今日任务</h2>
        <ul className="space-y-2">
          {tasks.map((t) => {
            const subj = tplSubject(t.templateId);
            return (
              <li key={t.id} className="card">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${subj ? SUBJECT_META[subj].dot : "bg-slate-300"}`} />
                    {tplName(t.templateId)}
                  </span>
                  {t.status === "scored" ? (
                    <span className="flex items-center gap-2">
                      <span className="chip bg-emerald-100 text-emerald-700">🎉 已评分 +{t.pointsAwarded}</span>
                      <button onClick={() => setScoring(scoring === t.id ? null : t.id)} className="btn btn-sky px-3 py-1 text-sm">查看/修改</button>
                    </span>
                  ) : (
                    <button onClick={() => setScoring(scoring === t.id ? null : t.id)} className="btn btn-primary px-3 py-1 text-sm">评分</button>
                  )}
                </div>
                {scoring === t.id && (
                  <ScoreForm
                    taskId={t.id}
                    initial={t.status === "scored" ? initialFor(t) : undefined}
                    onDone={() => { setScoring(null); loadTasks(); }}
                  />
                )}
              </li>
            );
          })}
          {tasks.length === 0 && <li className="text-slate-500">🙌 还没有任务，点上面派发。</li>}
        </ul>
      </div>
    </div>
  );
}
