import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { archiveBonusItem } from "@/lib/repositories/bonusItems";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  archiveBonusItem(getDb(), Number(id));
  return NextResponse.json({ ok: true });
}
