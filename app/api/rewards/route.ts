import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createReward, listRewards } from "@/lib/repositories/rewards";

export async function GET() {
  return NextResponse.json(listRewards(getDb()));
}

export async function POST(req: Request) {
  const body = await req.json();
  const reward = createReward(getDb(), { name: body.name, cost: Number(body.cost) });
  return NextResponse.json(reward);
}
