import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureDailyTasks } from "@/lib/repositories/tasks";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  return NextResponse.json(ensureDailyTasks(getDb(), Number(id), body.date));
}
