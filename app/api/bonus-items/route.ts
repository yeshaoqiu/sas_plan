import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listBonusItems, listAllBonusItems, createBonusItem } from "@/lib/repositories/bonusItems";

export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const db = getDb();
  return NextResponse.json(all ? listAllBonusItems(db) : listBonusItems(db));
}

export async function POST(req: Request) {
  const body = await req.json();
  const item = createBonusItem(getDb(), {
    name: body.name,
    description: body.description,
    points: Number(body.points),
    sortOrder: body.sortOrder === undefined ? undefined : Number(body.sortOrder),
  });
  return NextResponse.json(item);
}
