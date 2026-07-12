"use client";
import { useEffect, useState } from "react";

interface BonusItem { id: number; name: string; description: string; points: number }

// 习惯类加分项（专注/检查）单独抽出来做「是/否」必答提问，
// 逼家长每次评分都问孩子，从而养成习惯。其余加分项仍按复选框处理。
function isHabitItem(name: string): boolean {
  return name.includes("专注") || name.includes("检查");
}

// 用时 = 向上取整((完成时间 - 开始时间) / 分钟)，至少 1 分钟
function computeMinutes(startedAt?: string | null, completedAt?: string | null): number | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 1;
  return Math.max(1, Math.ceil(ms / 60000));
}

// 带 −/+ 按钮的数字步进输入：手机上没有原生上下箭头，且允许清空后重填
function Stepper({ value, onChange, min }: { value: string; onChange: (v: string) => void; min: number }) {
  const num = value === "" ? min : parseInt(value, 10);
  const step = (d: number) => onChange(String(Math.max(min, (Number.isNaN(num) ? min : num) + d)));
  return (
    <span className="ml-2 inline-flex items-center gap-1 align-middle">
      <button type="button" onClick={() => step(-1)} className="btn btn-sky h-8 w-8 p-0 text-lg">－</button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={(e) => { if (e.target.value === "") onChange(String(min)); }}
        className="input w-14 text-center"
      />
      <button type="button" onClick={() => step(1)} className="btn btn-sky h-8 w-8 p-0 text-lg">＋</button>
    </span>
  );
}

export function ScoreForm({
  taskId,
  onDone,
  initial,
  startedAt,
  completedAt,
  limitMinutes,
}: {
  taskId: number;
  onDone: () => void;
  initial?: { actualMinutes: number; errorCount: number; note: string; bonusItemIds: number[] };
  startedAt?: string | null;
  completedAt?: string | null;
  limitMinutes?: number | null;
}) {
  const autoMinutes = computeMinutes(startedAt, completedAt);
  const [items, setItems] = useState<BonusItem[]>([]);
  const [selected, setSelected] = useState<number[]>(initial?.bonusItemIds ?? []);
  // 习惯提问的答案：id → true(是)/false(否)/undefined(未答)
  const [habitAnswers, setHabitAnswers] = useState<Record<number, boolean>>({});
  const [actualMinutes, setMinutes] = useState(String(initial?.actualMinutes ?? autoMinutes ?? 5));
  const [errorCount, setErrors] = useState(String(initial?.errorCount ?? 0));
  const [note, setNote] = useState(initial?.note ?? "");
  const curMinutes = Math.max(1, parseInt(actualMinutes || "1", 10) || 1);
  const overBy = limitMinutes != null ? curMinutes - limitMinutes : 0;

  const habitItems = items.filter((it) => isHabitItem(it.name));
  const otherItems = items.filter((it) => !isHabitItem(it.name));
  const allHabitsAnswered = habitItems.every((it) => habitAnswers[it.id] !== undefined);

  useEffect(() => {
    fetch("/api/bonus-items").then((r) => r.json()).then((data: BonusItem[]) => {
      setItems(data);
      // 编辑已评分任务时，用已选中的加分项回填习惯提问答案（选中=是）
      if (initial) {
        const pre: Record<number, boolean> = {};
        for (const it of data) {
          if (isHabitItem(it.name)) pre[it.id] = (initial.bonusItemIds ?? []).includes(it.id);
        }
        setHabitAnswers(pre);
      }
    });
  }, []);

  function toggleItem(id: number, on: boolean) {
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  }

  // 回答习惯提问：同步更新 selected（是→加入，否→移除），数据结构与原来一致
  function answerHabit(id: number, yes: boolean) {
    setHabitAnswers((a) => ({ ...a, [id]: yes }));
    setSelected((s) => (yes ? (s.includes(id) ? s : [...s, id]) : s.filter((x) => x !== id)));
  }

  async function submit() {
    if (!allHabitsAnswered) {
      alert("请先回答上面关于「专注 / 检查」的问题再保存 🙂");
      return;
    }
    const minutes = Math.max(1, parseInt(actualMinutes || "1", 10) || 1);
    const errors = Math.max(0, parseInt(errorCount || "0", 10) || 0);
    const res = await fetch(`/api/tasks/${taskId}/score`, {
      method: "POST",
      body: JSON.stringify({ actualMinutes: minutes, bonusItemIds: selected, errorCount: errors, note }),
    });
    if (!res.ok) {
      alert((await res.json()).error);
      return;
    }
    const data = await res.json();
    if (Array.isArray(data.streakRewards) && data.streakRewards.length > 0) {
      const msg = data.streakRewards
        .map((m: { label: string; reward: number }) => `🔥 ${m.label}打卡，奖励 +${m.reward}⭐`)
        .join("\n");
      alert(msg);
    }
    onDone();
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-100">
      <div className="flex flex-wrap items-center gap-x-2">
        <span>用时(分钟)</span>
        <Stepper value={actualMinutes} onChange={setMinutes} min={1} />
        {limitMinutes != null && (
          <span className="text-xs text-slate-500">要求 {limitMinutes} 分钟</span>
        )}
        {autoMinutes != null && (
          <span className="text-xs text-slate-500">
            · 自动算得 {autoMinutes} 分钟
            {String(autoMinutes) !== actualMinutes && (
              <button type="button" onClick={() => setMinutes(String(autoMinutes))} className="ml-1 text-sky-600 underline">用此值</button>
            )}
          </span>
        )}
        {limitMinutes != null && curMinutes > limitMinutes && (
          <span className="w-full rounded-lg bg-rose-100 px-2 py-1 text-sm font-semibold text-rose-600">
            ⚠️ 已超时！用时 {curMinutes} 分钟，超过要求 {limitMinutes} 分钟{overBy > 0 ? `（超 ${overBy} 分钟）` : ""}，请谨慎评估是否勾选按时完成加分项。
          </span>
        )}
      </div>
      {habitItems.length > 0 && (
        <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-amber-200">
          <div className="text-sm font-semibold text-slate-700">好习惯打卡（请如实回答）</div>
          {habitItems.map((it) => {
            const ans = habitAnswers[it.id];
            return (
              <div key={it.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {it.name}？<span className="text-amber-600">+{it.points}</span>
                  {it.description && <span className="block text-xs font-normal text-slate-500">{it.description}</span>}
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => answerHabit(it.id, true)}
                    className={`btn px-4 py-1 text-sm ${ans === true ? "btn-emerald" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >是</button>
                  <button
                    type="button"
                    onClick={() => answerHabit(it.id, false)}
                    className={`btn px-4 py-1 text-sm ${ans === false ? "btn-rose" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >否</button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {otherItems.length > 0 && (
        <div className="space-y-1">
          {otherItems.map((it) => (
            <label key={it.id} className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={selected.includes(it.id)} onChange={(e) => toggleItem(it.id, e.target.checked)} />
              <span>
                <span className="font-medium">{it.name} <span className="text-amber-600">+{it.points}</span></span>
                {it.description && <span className="block text-xs text-slate-500">{it.description}</span>}
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center">
        <span>错题数</span>
        <Stepper value={errorCount} onChange={setErrors} min={0} />
      </div>
      <input placeholder="备注" value={note} onChange={(e) => setNote(e.target.value)} className="input w-full" />
      <button onClick={submit} disabled={!allHabitsAnswered} className="btn btn-emerald">
        {allHabitsAnswered ? "保存评分" : "请先回答好习惯打卡"}
      </button>
    </div>
  );
}
