"use client";
import { useEffect, useState } from "react";

interface Child { id: number; name: string; avatar: string }
interface Pet { level: number; emoji: string; name: string; curMin: number; nextMin: number | null; toNext: number }
interface Growth { earned: number; streak: number; pet: Pet }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function GrowthPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [g, setG] = useState<Growth | null>(null);

  useEffect(() => {
    fetch("/api/children").then((r) => r.json()).then((c: Child[]) => {
      setChildren(c);
      if (c[0]) setChildId(c[0].id);
    });
  }, []);

  useEffect(() => {
    if (!childId) return;
    fetch(`/api/children/${childId}/growth?today=${today()}`).then((r) => r.json()).then(setG);
  }, [childId]);

  const pct = g && g.pet.nextMin !== null
    ? Math.min(100, Math.round(((g.earned - g.pet.curMin) / (g.pet.nextMin - g.pet.curMin)) * 100))
    : 100;

  return (
    <div className="space-y-6">
      <select value={childId ?? ""} onChange={(e) => setChildId(+e.target.value)} className="input">
        {children.map((c) => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
      </select>

      {g && (
        <div className="card flex flex-col items-center gap-3 py-8">
          <div className="text-7xl">{g.pet.emoji}</div>
          <div className="text-xl font-bold">Lv.{g.pet.level} {g.pet.name}</div>
          <div className="w-full max-w-sm">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>累计获得 {g.earned}⭐</span>
              <span>{g.pet.nextMin === null ? "已满级" : `距下一级还差 ${g.pet.toNext}⭐`}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-amber-100">
              <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="chip bg-orange-100 text-orange-700 text-base">🔥 连续 {g.streak} 天</div>
        </div>
      )}
    </div>
  );
}
