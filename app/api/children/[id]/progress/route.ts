import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getDayProgress } from "@/lib/repositories/tasks";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const date = new URL(req.url).searchParams.get("date") ?? "";
  return NextResponse.json(getDayProgress(getDb(), Number(id), date));
}
