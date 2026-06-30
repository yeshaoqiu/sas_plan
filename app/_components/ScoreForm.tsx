"use client";
import { useState } from "react";

export function ScoreForm({
  taskId,
  onDone,
  initial,
}: {
  taskId: number;
  onDone: () => void;
  initial?: {
    actualMinutes: number;
    focused: boolean;
    usedScaffold: boolean;
    didCheck: boolean;
    errorCount: number;
    note: string;
  };
}) {
  const [actualMinutes, setMinutes] = useState(initial?.actualMinutes ?? 5);
  const [focused, setFocused] = useState(initial?.focused ?? false);
  const [usedScaffold, setScaffold] = useState(initial?.usedScaffold ?? false);
  const [didCheck, setCheck] = useState(initial?.didCheck ?? false);
  const [errorCount, setErrors] = useState(initial?.errorCount ?? 0);
  const [note, setNote] = useState(initial?.note ?? "");

  async function submit() {
    const res = await fetch(`/api/tasks/${taskId}/score`, {
      method: "POST",
      body: JSON.stringify({ actualMinutes, focused, usedScaffold, didCheck, errorCount, note }),
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
      <label className="mr-3"><input type="checkbox" checked={focused} onChange={(e) => setFocused(e.target.checked)} /> 专注完成</label>
      <label className="mr-3"><input type="checkbox" checked={usedScaffold} onChange={(e) => setScaffold(e.target.checked)} /> 用上支架</label>
      <label className="mr-3"><input type="checkbox" checked={didCheck} onChange={(e) => setCheck(e.target.checked)} /> 做了检查</label>
      <label className="block">错题数
        <input type="number" value={errorCount} onChange={(e) => setErrors(+e.target.value)} className="input ml-2 w-16" />
      </label>
      <input placeholder="备注" value={note} onChange={(e) => setNote(e.target.value)} className="input w-full" />
      <button onClick={submit} className="btn btn-emerald">保存评分</button>
    </div>
  );
}
