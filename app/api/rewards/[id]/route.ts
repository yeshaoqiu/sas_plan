import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { updateReward } from "@/lib/repositories/rewards";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const reward = updateReward(getDb(), Number(id), {
    name: body.name,
    cost: Number(body.cost),
  });
  return NextResponse.json(reward);
}
