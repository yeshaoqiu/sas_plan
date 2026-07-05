"use client";
import { useEffect, useState } from "react";

interface BonusItem { id: number; name: string; description: string; points: number }

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
  const [actualMinutes, setMinutes] = useState(String(initial?.actualMinutes ?? autoMinutes ?? 5));
  const [errorCount, setErrors] = useState(String(initial?.errorCount ?? 0));
  const [note, setNote] = useState(initial?.note ?? "");
  const curMinutes = Math.max(1, parseInt(actualMinutes || "1", 10) || 1);
  const overBy = limitMinutes != null ? curMinutes - limitMinutes : 0;

  useEffect(() => {
    fetch("/api/bonus-items").then((r) => r.json()).then(setItems);
  }, []);

  function toggleItem(id: number, on: boolean) {
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  }

  async function submit() {
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
      <div className="space-y-1">
        {items.map((it) => (
          <label key={it.id} className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={selected.includes(it.id)} onChange={(e) => toggleItem(it.id, e.target.checked)} />
            <span>
              <span className="font-medium">{it.name} <span className="text-amber-600">+{it.points}</span></span>
              {it.description && <span className="block text-xs text-slate-500">{it.description}</span>}
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center">
        <span>错题数</span>
        <Stepper value={errorCount} onChange={setErrors} min={0} />
      </div>
      <input placeholder="备注" value={note} onChange={(e) => setNote(e.target.value)} className="input w-full" />
      <button onClick={submit} className="btn btn-emerald">保存评分</button>
    </div>
  );
}
