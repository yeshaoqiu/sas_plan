"use client";
import { useEffect, useRef, useState } from "react";

interface Child { id: number; name: string; avatar: string }
interface Pet { level: number; emoji: string; name: string; curMin: number; nextMin: number | null; nextEmoji: string | null; nextName: string | null; toNext: number }
interface Badge { id: string; emoji: string; name: string; desc: string; unlocked: boolean }
interface Growth { earned: number; streak: number; pet: Pet; badges: Badge[] }
interface Leader { childId: number; name: string; avatar: string; weekEarned: number; streak: number; maxStreak: number; lifetimeEarned: number }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CONFETTI = ["🎉", "⭐", "✨", "🎊", "🌟"];

export default function GrowthPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [g, setG] = useState<Growth | null>(null);
  const [board, setBoard] = useState<Leader[]>([]);
  const [celebrate, setCelebrate] = useState<Pet | null>(null);
  const seenLevel = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/children").then((r) => r.json()).then((c: Child[]) => {
      setChildren(c);
      if (c[0]) setChildId(c[0].id);
    });
    fetch(`/api/leaderboard?today=${today()}`).then((r) => r.json()).then(setBoard);
  }, []);

  useEffect(() => {
    if (!childId) return;
    seenLevel.current = null;
    fetch(`/api/children/${childId}/growth?today=${today()}`).then((r) => r.json()).then((data: Growth) => {
      setG(data);
      const key = `pet-level-${childId}`;
      const prev = Number(localStorage.getItem(key) ?? "");
      // 首次查看该孩子不庆祝，只记录；之后等级提升才触发
      if (prev && data.pet.level > prev) setCelebrate(data.pet);
      seenLevel.current = data.pet.level;
      localStorage.setItem(key, String(data.pet.level));
    });
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
          {g.pet.nextEmoji && (
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-400">
              <span>下一进化</span>
              <span className="text-3xl grayscale opacity-50" style={{ filter: "grayscale(1) brightness(0.7)" }}>
                {g.pet.nextEmoji}
              </span>
              <span>{g.pet.nextName}</span>
            </div>
          )}
          <div className="chip bg-orange-100 text-orange-700 text-base">🔥 连续 {g.streak} 天</div>
        </div>
      )}

      {g && g.badges && (
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg">🏅 成就徽章</h2>
            <span className="text-sm text-slate-400">
              {g.badges.filter((b) => b.unlocked).length}/{g.badges.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {g.badges.map((b) => (
              <div
                key={b.id}
                className={`flex flex-col items-center gap-1 rounded-xl p-3 text-center transition ${
                  b.unlocked ? "bg-amber-50 ring-1 ring-amber-200" : "bg-slate-50 opacity-60"
                }`}
                title={b.desc}
              >
                <span className={`text-3xl ${b.unlocked ? "" : "grayscale"}`} style={b.unlocked ? undefined : { filter: "grayscale(1)" }}>
                  {b.emoji}
                </span>
                <span className="text-xs font-medium text-slate-700">{b.name}</span>
                <span className="text-[10px] leading-tight text-slate-400">{b.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {board.length > 1 && (
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg">🏆 本周排行榜</h2>
            <span className="text-sm text-slate-400">比一比谁挣的星星多</span>
          </div>
          <ul className="space-y-2">
            {board.map((row, i) => {
              const medal = ["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`;
              const me = row.childId === childId;
              return (
                <li
                  key={row.childId}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                    me ? "bg-amber-100 ring-1 ring-amber-300" : "bg-slate-50"
                  }`}
                >
                  <span className="w-6 text-center text-lg">{medal}</span>
                  <span className="text-2xl">{row.avatar}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
                  {row.streak > 0 && (
                    <span className="chip bg-orange-100 text-orange-600 text-xs">🔥{row.streak}</span>
                  )}
                  <span className="font-bold text-amber-600">{row.weekEarned}⭐</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {celebrate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setCelebrate(null)}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className="animate-confetti absolute text-2xl"
                style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i % 6) * 0.12}s` }}
              >
                {CONFETTI[i % CONFETTI.length]}
              </span>
            ))}
          </div>
          <div className="card relative flex flex-col items-center gap-3 px-10 py-8 text-center">
            <div className="animate-level-pop text-7xl">{celebrate.emoji}</div>
            <div className="text-lg font-bold text-amber-600">🎉 恭喜进化！</div>
            <div className="text-xl font-extrabold">Lv.{celebrate.level} {celebrate.name}</div>
            <button className="btn btn-primary mt-2" onClick={() => setCelebrate(null)}>太棒了！</button>
          </div>
        </div>
      )}
    </div>
  );
}
