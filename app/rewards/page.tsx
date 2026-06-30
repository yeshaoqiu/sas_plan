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
      </ul>

      <div className="flex gap-2">
        <input placeholder="奖励名" value={rName} onChange={(e) => setRName(e.target.value)} className="input" />
        <input type="number" value={rCost} onChange={(e) => setRCost(+e.target.value)} className="input w-24" />
        <button onClick={addReward} className="btn btn-primary px-3 py-1">新增奖励</button>
      </div>
    </div>
  );
}
