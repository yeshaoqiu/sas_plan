import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createChild, listChildren, listAllChildren } from "@/lib/repositories/children";

export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const db = getDb();
  return NextResponse.json(all ? listAllChildren(db) : listChildren(db));
}

export async function POST(req: Request) {
  const body = await req.json();
  try {
    const child = createChild(getDb(), {
      name: body.name,
      grade: Number(body.grade),
      avatar: body.avatar,
    });
    return NextResponse.json(child);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
