"use client";
import { useEffect, useState } from "react";

interface BonusItem { id: number; name: string; description: string; points: number }

export function ScoreForm({
  taskId,
  onDone,
  initial,
}: {
  taskId: number;
  onDone: () => void;
  initial?: { actualMinutes: number; errorCount: number; note: string; bonusItemIds: number[] };
}) {
  const [items, setItems] = useState<BonusItem[]>([]);
  const [selected, setSelected] = useState<number[]>(initial?.bonusItemIds ?? []);
  const [actualMinutes, setMinutes] = useState(initial?.actualMinutes ?? 5);
  const [errorCount, setErrors] = useState(initial?.errorCount ?? 0);
  const [note, setNote] = useState(initial?.note ?? "");

  useEffect(() => {
    fetch("/api/bonus-items").then((r) => r.json()).then(setItems);
  }, []);

  function toggleItem(id: number, on: boolean) {
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  }

  async function submit() {
    const res = await fetch(`/api/tasks/${taskId}/score`, {
      method: "POST",
      body: JSON.stringify({ actualMinutes, bonusItemIds: selected, errorCount, note }),
    });
    if (!res.ok) {
      alert((await res.json()).error);
      return;
    }
    onDone();
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-100">
      <label className="block">用时(分钟)
        <input type="number" value={actualMinutes} onChange={(e) => setMinutes(+e.target.value)} className="input ml-2 w-16" />
      </label>
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
      <label className="block">错题数
        <input type="number" value={errorCount} onChange={(e) => setErrors(+e.target.value)} className="input ml-2 w-16" />
      </label>
      <input placeholder="备注" value={note} onChange={(e) => setNote(e.target.value)} className="input w-full" />
      <button onClick={submit} className="btn btn-emerald">保存评分</button>
    </div>
  );
}
