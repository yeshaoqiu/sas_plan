import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getLeaderboard } from "@/lib/repositories/leaderboard";

// 返回本周一 00:00 的日期字符串（UTC 基准，与其余日期处理一致）
function weekStartOf(today: string): string {
  const dt = new Date(today + "T00:00:00Z");
  const dow = dt.getUTCDay(); // 0=周日
  const back = dow === 0 ? 6 : dow - 1; // 回退到周一
  dt.setUTCDate(dt.getUTCDate() - back);
  return dt.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const today = new URL(req.url).searchParams.get("today") ?? "";
  const weekStart = weekStartOf(today);
  return NextResponse.json(getLeaderboard(getDb(), weekStart, today));
}
