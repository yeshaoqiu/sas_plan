import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { addPointEntry, getBalance } from "@/lib/repositories/points";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const childId = Number(id);
  const body = await req.json();
  const delta = Math.trunc(Number(body.delta));
  const reason = String(body.reason ?? "").trim();

  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: "请填写非零的星星数量" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "请填写原因" }, { status: 400 });
  }

  const db = getDb();
  if (delta < 0) {
    const balance = getBalance(db, childId);
    if (balance + delta < 0) {
      return NextResponse.json(
        { error: `余额不足：当前 ${balance}⭐，无法扣除 ${-delta}⭐` },
        { status: 400 },
      );
    }
  }

  const label = delta > 0 ? "手动奖励" : "手动扣减";
  const entry = addPointEntry(db, { childId, delta, reason: `${label}：${reason}` });
  return NextResponse.json({ entry, balance: getBalance(db, childId) });
}
