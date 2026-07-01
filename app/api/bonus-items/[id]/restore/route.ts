import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { restoreBonusItem } from "@/lib/repositories/bonusItems";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  restoreBonusItem(getDb(), Number(id));
  return NextResponse.json({ ok: true });
}
