import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { updateBonusItem } from "@/lib/repositories/bonusItems";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const item = updateBonusItem(getDb(), Number(id), {
    name: body.name,
    description: body.description,
    points: Number(body.points),
    sortOrder: Number(body.sortOrder),
  });
  return NextResponse.json(item);
}
