import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createReward, listRewards, listAllRewards } from "@/lib/repositories/rewards";

export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const db = getDb();
  return NextResponse.json(all ? listAllRewards(db) : listRewards(db));
}

export async function POST(req: Request) {
  const body = await req.json();
  const reward = createReward(getDb(), { name: body.name, cost: Number(body.cost) });
  return NextResponse.json(reward);
}
