import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { completeTask } from "@/lib/repositories/tasks";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(completeTask(getDb(), Number(id)));
}
