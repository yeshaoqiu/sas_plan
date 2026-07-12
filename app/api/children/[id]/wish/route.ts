import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getWishProgress, setWish } from "@/lib/repositories/children";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(getWishProgress(getDb(), Number(id)));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const rewardId =
    body.rewardId === null || body.rewardId === undefined ? null : Number(body.rewardId);
  try {
    setWish(getDb(), Number(id), rewardId);
    return NextResponse.json(getWishProgress(getDb(), Number(id)));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
