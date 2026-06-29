import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createChild, listChildren } from "@/lib/repositories/children";

export async function GET() {
  return NextResponse.json(listChildren(getDb()));
}

export async function POST(req: Request) {
  const body = await req.json();
  const child = createChild(getDb(), {
    name: body.name,
    grade: Number(body.grade),
    avatar: body.avatar,
  });
  return NextResponse.json(child);
}
