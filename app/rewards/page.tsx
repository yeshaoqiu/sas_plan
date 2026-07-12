"use client";
import { useEffect, useState } from "react";

export default function Rewards() {
  const [children, setChildren] = useState<any[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<any[]>([]);
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [wishId, setWishId] = useState<number | null>(null);

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
    const w = await fetch(`/api/children/${childId}/wish`).then((r) => r.json());
    setWishId(w.reward?.id ?? null);
  }
  useEffect(() => { loadBalance(); }, [childId]);

  async function toggleWish(rewardId: number) {
    if (!childId) return;
    const next = wishId === rewardId ? null : rewardId;
    const res = await fetch(`/api/children/${childId}/wish`, {
      method: "PUT",
      body: JSON.stringify({ rewardId: next }),
    });
    if (!res.ok) { alert((await res.json()).error); return; }
    setWishId(next);
  }

  const getQty = (id: number) => qtys[id] ?? 1;
  const setQty = (id: number, v: number) => setQtys((q) => ({ ...q, [id]: v }));

  async function redeem(rewardId: number) {
    const reward = rewards.find((r) => r.id === rewardId);
    const name = reward?.name ?? "该奖励";
    const cost = reward?.cost ?? 0;
    const maxQty = cost > 0 ? Math.floor(balance / cost) : 0;
    const qty = Math.min(getQty(rewardId), maxQty);
    if (qty < 1) return;
    const total = cost * qty;
    const label = qty > 1 ? `${qty} 次「${name}」（共 ${total}⭐）` : `「${name}」（${total}⭐）`;
    if (!confirm(`确认兑换 ${label} 吗？兑换后将从积分中扣除。`)) return;
    const res = await fetch(`/api/rewards/${rewardId}/redeem`, {
      method: "POST",
      body: JSON.stringify({ childId, quantity: qty }),
    });
    if (!res.ok) { alert((await res.json()).error); return; }
    setQty(rewardId, 1);
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
        {rewards.map((r) => {
          const maxQty = r.cost > 0 ? Math.floor(balance / r.cost) : 0;
          const affordable = maxQty >= 1;
          const qty = Math.min(Math.max(1, getQty(r.id)), Math.max(1, maxQty));
          return (
            <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
              <span className="flex-1">
                {r.name}（{r.cost} 分）
                {wishId === r.id && <span className="ml-2 chip bg-pink-100 text-pink-600 text-xs">💖 心愿</span>}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleWish(r.id)}
                  title={wishId === r.id ? "取消心愿" : "设为心愿目标"}
                  className={`text-xl leading-none transition-transform hover:scale-110 ${wishId === r.id ? "" : "opacity-40 grayscale"}`}
                >
                  💖
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQty(r.id, Math.max(1, qty - 1))}
                    disabled={!affordable || qty <= 1}
                    className="btn btn-sky h-8 w-8 p-0 text-lg"
                  >－</button>
                  <span className="w-6 text-center font-semibold">{affordable ? qty : 0}</span>
                  <button
                    onClick={() => setQty(r.id, Math.min(maxQty, qty + 1))}
                    disabled={!affordable || qty >= maxQty}
                    className="btn btn-sky h-8 w-8 p-0 text-lg"
                  >＋</button>
                </div>
                <button
                  onClick={() => redeem(r.id)}
                  disabled={!affordable}
                  className="btn btn-rose px-3 py-1 text-sm"
                >
                  兑换{affordable && qty > 1 ? ` ×${qty}（${r.cost * qty}⭐）` : ""}
                </button>
              </div>
            </li>
          );
        })}
        {rewards.length === 0 && <li className="text-slate-500">还没有奖励，去「管理」添加。</li>}
      </ul>
    </div>
  );
}
