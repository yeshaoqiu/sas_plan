import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { redeemReward } from "@/lib/repositories/rewards";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  try {
    const res = redeemReward(getDb(), {
      childId: Number(body.childId),
      rewardId: Number(id),
      quantity: body.quantity != null ? Number(body.quantity) : 1,
    });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
