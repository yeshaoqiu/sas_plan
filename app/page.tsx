"use client";
import { useEffect, useRef, useState } from "react";
import { ScoreForm } from "./_components/ScoreForm";
import { SUBJECT_META } from "./_components/subjectMeta";
import { shiftDate, todayStr } from "./_components/dateNav";
import type { Subject } from "@/lib/types";

interface Child { id: number; name: string; avatar: string }
interface Template { id: number; name: string; subject: Subject; defaultMinutes: number }
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
  bonusItemIds: number[];
  startedAt: string | null;
  completedAt: string | null;
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
  const [spin, setSpin] = useState<{ unlocked: boolean; spun: boolean; prizeReward: number | null }>({ unlocked: false, spun: false, prizeReward: null });
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<{ emoji: string; label: string; reward: number } | null>(null);
  const [wish, setWish] = useState<{ reward: { id: number; name: string; cost: number } | null; balance: number; remaining: number; achieved: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/children").then((r) => r.json()).then((c) => {
      setChildren(c);
      if (c[0]) setChildId(c[0].id);
    });
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
  }, []);

  async function loadTasks() {
    if (!childId) return;
    if (date >= today()) {
      await fetch(`/api/children/${childId}/ensure-day`, {
        method: "POST",
        body: JSON.stringify({ date }),
      });
    }
    const t = await fetch(`/api/tasks?childId=${childId}&date=${date}`).then((r) => r.json());
    setTasks(t);
    const p = await fetch(`/api/children/${childId}/progress?date=${date}`).then((r) => r.json());
    setProgress(p);
    const s = await fetch(`/api/children/${childId}/spin?date=${date}`).then((r) => r.json());
    setSpin(s);
    setSpinResult(null);
    const w = await fetch(`/api/children/${childId}/wish`).then((r) => r.json());
    setWish(w);
  }
  useEffect(() => { loadTasks(); }, [childId, date]);

  async function doSpin() {
    if (!childId || spinning) return;
    setSpinning(true);
    const res = await fetch(`/api/children/${childId}/spin`, {
      method: "POST",
      body: JSON.stringify({ date }),
    });
    // 转盘动画时长
    await new Promise((r) => setTimeout(r, 900));
    setSpinning(false);
    if (!res.ok) { alert((await res.json()).error); loadTasks(); return; }
    const { prize } = await res.json();
    setSpinResult(prize);
    setSpin((s) => ({ ...s, spun: true, prizeReward: prize.reward }));
  }

  async function assign(templateId: number) {
    const res = await fetch("/api/tasks", { method: "POST", body: JSON.stringify({ childId, templateId, date }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    loadTasks();
  }

  async function startTaskAction(id: number) {
    await fetch(`/api/tasks/${id}/start`, { method: "POST" });
    loadTasks();
  }
  async function completeTaskAction(id: number) {
    await fetch(`/api/tasks/${id}/complete`, { method: "POST" });
    loadTasks();
  }
  async function removeTask(id: number) {
    if (!confirm("删除这个任务？（已评分的不能删）")) return;
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) { alert((await res.json()).error); return; }
    loadTasks();
  }
  // 移动端长按（600ms）删除未开始的任务
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onPressStart(id: number) {
    pressTimer.current = setTimeout(() => removeTask(id), 600);
  }
  function onPressEnd() {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  }

  const assignedTemplateIds = new Set(tasks.map((t) => t.templateId));

  const tplName = (id: number) => templates.find((t) => t.id === id)?.name ?? "?";
  const tplSubject = (id: number) => templates.find((t) => t.id === id)?.subject;
  const initialFor = (t: Task) => ({
    actualMinutes: t.actualMinutes ?? 5,
    errorCount: t.errorCount ?? 0,
    note: t.note ?? "",
    bonusItemIds: t.bonusItemIds ?? [],
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={childId ?? ""} onChange={(e) => setChildId(+e.target.value)} className="input">
          {children.map((c) => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        <div className="flex gap-1">
          <button onClick={() => setDate(shiftDate(date, -1))} className="btn btn-sky px-3 py-1.5 text-sm">前一天</button>
          <button onClick={() => setDate(todayStr())} className="btn btn-primary px-3 py-1.5 text-sm">今天</button>
          <button onClick={() => setDate(shiftDate(date, 1))} className="btn btn-sky px-3 py-1.5 text-sm">后一天</button>
        </div>
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

      {wish && wish.reward && (
        <div className="card bg-gradient-to-b from-pink-50 to-white">
          <div className="mb-1 flex items-center justify-between text-sm font-medium">
            <span>💖 我的心愿：{wish.reward.name}</span>
            {wish.achieved ? (
              <span className="text-emerald-600 font-bold">🎉 可以兑换啦！</span>
            ) : (
              <span className="text-pink-600">还差 {wish.remaining}⭐</span>
            )}
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-pink-100">
            <div
              className="h-full rounded-full bg-pink-400 transition-all"
              style={{ width: `${wish.reward.cost ? Math.min(100, Math.round((wish.balance / wish.reward.cost) * 100)) : 100}%` }}
            />
          </div>
          <div className="mt-1 text-right text-xs text-slate-400">{wish.balance} / {wish.reward.cost}⭐</div>
        </div>
      )}

      {spin.unlocked && (
        <div className="card flex flex-col items-center gap-3 bg-gradient-to-b from-amber-50 to-white py-5 text-center">
          <div className="font-semibold text-amber-700">🎡 今日任务全部完成，转盘抽奖！</div>
          <div className={`text-6xl ${spinning ? "animate-spin-wheel" : ""}`}>
            {spinResult ? spinResult.emoji : "🎁"}
          </div>
          {spinResult ? (
            <div className="animate-level-pop text-lg font-bold text-emerald-600">
              {spinResult.label} +{spinResult.reward}⭐
            </div>
          ) : spin.spun ? (
            <div className="text-sm text-slate-500">
              今天已抽奖 · 获得 +{spin.prizeReward}⭐，明天再来！
            </div>
          ) : (
            <button onClick={doSpin} disabled={spinning} className="btn btn-primary px-6">
              {spinning ? "抽奖中…" : "开始抽奖 🎲"}
            </button>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-2 font-semibold">今日任务</h2>
        <ul className="space-y-2">
          {tasks.map((t) => {
            const subj = tplSubject(t.templateId);
            const canDelete = t.status !== "scored";
            return (
              <li
                key={t.id}
                className={`card group ${canDelete ? "select-none" : ""}`}
                onTouchStart={canDelete ? () => onPressStart(t.id) : undefined}
                onTouchEnd={canDelete ? onPressEnd : undefined}
                onTouchMove={canDelete ? onPressEnd : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${subj ? SUBJECT_META[subj].dot : "bg-slate-300"}`} />
                    <span className="min-w-0">{tplName(t.templateId)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {canDelete && (
                      <button
                        onClick={() => removeTask(t.id)}
                        title="删除该任务"
                        className="hidden whitespace-nowrap text-sm text-rose-500 group-hover:inline sm:inline-block sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                      >
                        删除
                      </button>
                    )}
                    {t.status === "pending" && (
                      <button onClick={() => startTaskAction(t.id)} className="btn btn-sky whitespace-nowrap px-3 py-1 text-sm">开始</button>
                    )}
                    {t.status === "in_progress" && (
                      <button onClick={() => completeTaskAction(t.id)} className="btn btn-emerald whitespace-nowrap px-3 py-1 text-sm">完成</button>
                    )}
                    {t.status === "done" && (
                      <button onClick={() => setScoring(scoring === t.id ? null : t.id)} className="btn btn-primary whitespace-nowrap px-3 py-1 text-sm">评分</button>
                    )}
                    {t.status === "scored" && (
                      <button onClick={() => setScoring(scoring === t.id ? null : t.id)} className="btn btn-sky whitespace-nowrap px-3 py-1 text-sm">查看/修改</button>
                    )}
                  </span>
                </div>
                {t.status === "scored" && (
                  <div className="mt-1">
                    <span className="chip bg-emerald-100 text-emerald-700">🎉 已评分 +{t.pointsAwarded}</span>
                  </div>
                )}
                {scoring === t.id && (
                  <ScoreForm
                    key={t.id}
                    taskId={t.id}
                    initial={t.status === "scored" ? initialFor(t) : undefined}
                    startedAt={t.startedAt}
                    completedAt={t.completedAt}
                    limitMinutes={templates.find((x) => x.id === t.templateId)?.defaultMinutes ?? null}
                    onDone={() => { setScoring(null); loadTasks(); }}
                  />
                )}
              </li>
            );
          })}
          {tasks.length === 0 && <li className="text-slate-500">🙌 还没有任务，点下面派发。</li>}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">派发任务</h2>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => {
            const assigned = assignedTemplateIds.has(t.id);
            return (
              <button
                key={t.id}
                onClick={() => assign(t.id)}
                disabled={assigned}
                title={assigned ? "今天已派发" : undefined}
                className="btn btn-sky px-3 py-1 text-sm"
              >
                {assigned ? "✓ " : "+ "}{t.name}
              </button>
            );
          })}
          {templates.length === 0 && <span className="text-sm text-slate-500">还没有任务模板，去「管理」添加。</span>}
        </div>
      </div>
    </div>
  );
}
