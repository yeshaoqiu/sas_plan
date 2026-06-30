"use client";
import { useEffect, useState } from "react";

export default function Rewards() {
  const [children, setChildren] = useState<any[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<any[]>([]);
  const [rName, setRName] = useState("");
  const [rCost, setRCost] = useState(30);

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
  async function addReward() {
    const res = await fetch("/api/rewards", { method: "POST", body: JSON.stringify({ name: rName, cost: rCost }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    setRName("");
    fetch("/api/rewards").then((r) => r.json()).then(setRewards);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <select value={childId ?? ""} onChange={(e) => setChildId(+e.target.value)} className="rounded border px-2 py-1">
          {children.map((c) => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
        </select>
        <span className="text-2xl font-bold text-amber-500">⭐ {balance}</span>
      </div>

      <ul className="space-y-2">
        {rewards.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded bg-white p-3 shadow-sm">
            <span>{r.name}（{r.cost} 分）</span>
            <button onClick={() => redeem(r.id)} disabled={balance < r.cost} className="rounded bg-rose-500 px-3 py-1 text-white disabled:bg-slate-300">兑换</button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <input placeholder="奖励名" value={rName} onChange={(e) => setRName(e.target.value)} className="rounded border px-2 py-1" />
        <input type="number" value={rCost} onChange={(e) => setRCost(+e.target.value)} className="w-24 rounded border px-2 py-1" />
        <button onClick={addReward} className="rounded bg-sky-500 px-3 py-1 text-white">新增奖励</button>
      </div>
    </div>
  );
}
