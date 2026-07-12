import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getLifetimeEarned } from "@/lib/repositories/points";
import { getStreak, getMaxStreak, getBadgeStats } from "@/lib/repositories/growth";
import { getPetStage } from "@/lib/pet";
import { evaluateBadges } from "@/lib/badges";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const today = new URL(req.url).searchParams.get("today") ?? "";
  const db = getDb();
  const childId = Number(id);
  const earned = getLifetimeEarned(db, childId);
  const streak = getStreak(db, childId, today);
  const maxStreak = getMaxStreak(db, childId);
  const { scoredCount, focusedCount, checkedCount } = getBadgeStats(db, childId);
  const badges = evaluateBadges({ earned, maxStreak, scoredCount, focusedCount, checkedCount });
  return NextResponse.json({ earned, streak, pet: getPetStage(earned), badges });
}
