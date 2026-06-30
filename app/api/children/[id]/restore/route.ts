import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { restoreChild } from "@/lib/repositories/children";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  restoreChild(getDb(), Number(id));
  return NextResponse.json({ ok: true });
}
