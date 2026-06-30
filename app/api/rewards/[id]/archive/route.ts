import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { archiveReward } from "@/lib/repositories/rewards";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  archiveReward(getDb(), Number(id));
  return NextResponse.json({ ok: true });
}
