"use client";
import { useEffect, useState } from "react";

export default function Rewards() {
  const [children, setChildren] = useState<any[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/children").then((r) => r.json()).then((c) => {
      setChildren(c);
      if (c[0]) setChildId(c[0].id);
    });
    fetch("/api/rewards").then((r) => r.json()).then(setRewards);
  }, []);

  async function loadBalance() {
    if (!childId) return;
    const b = await fetch(`/api/children/${childId}/balance`).then((r) => r.json());
    setBalance(b.balance);
  }
  useEffect(() => { loadBalance(); }, [childId]);

  async function redeem(rewardId: number) {
    const res = await fetch(`/api/rewards/${rewardId}/redeem`, { method: "POST", body: JSON.stringify({ childId }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    loadBalance();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <select value={childId ?? ""} onChange={(e) => setChildId(+e.target.value)} className="input">
          {children.map((c) => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
        </select>
        <span className="balance-badge">⭐ {balance}</span>
      </div>

      <ul className="space-y-2">
        {rewards.map((r) => (
          <li key={r.id} className="card flex items-center justify-between">
            <span>{r.name}（{r.cost} 分）</span>
            <button onClick={() => redeem(r.id)} disabled={balance < r.cost} className="btn btn-rose px-3 py-1">兑换</button>
          </li>
        ))}
        {rewards.length === 0 && <li className="text-slate-500">还没有奖励，去「管理」添加。</li>}
      </ul>
    </div>
  );
}
