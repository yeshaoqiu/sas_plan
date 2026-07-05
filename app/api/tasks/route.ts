import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { assignTask, listTasks } from "@/lib/repositories/tasks";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const childId = Number(searchParams.get("childId"));
  const date = searchParams.get("date") ?? "";
  return NextResponse.json(listTasks(getDb(), childId, date));
}

export async function POST(req: Request) {
  const body = await req.json();
  try {
    const task = assignTask(getDb(), {
      childId: Number(body.childId),
      templateId: Number(body.templateId),
      date: body.date,
    });
    return NextResponse.json(task);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
