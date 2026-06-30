import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { updateChild } from "@/lib/repositories/children";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const child = updateChild(getDb(), Number(id), {
    name: body.name,
    grade: Number(body.grade),
    avatar: body.avatar,
  });
  return NextResponse.json(child);
}
