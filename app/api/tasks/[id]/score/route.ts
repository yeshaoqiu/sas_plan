import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { scoreTask } from "@/lib/repositories/tasks";
import { grantStreakRewards } from "@/lib/repositories/growth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  try {
    const db = getDb();
    const task = scoreTask(db, Number(id), {
      actualMinutes: Number(body.actualMinutes),
      bonusItemIds: Array.isArray(body.bonusItemIds) ? body.bonusItemIds.map(Number) : [],
      errorCount: Number(body.errorCount ?? 0),
      note: body.note,
    });
    const streakRewards = grantStreakRewards(db, task.childId, task.date);
    return NextResponse.json({ ...task, streakRewards });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
