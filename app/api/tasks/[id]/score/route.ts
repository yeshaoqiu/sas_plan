import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { scoreTask } from "@/lib/repositories/tasks";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  try {
    const task = scoreTask(getDb(), Number(id), {
      actualMinutes: Number(body.actualMinutes),
      focused: !!body.focused,
      usedScaffold: !!body.usedScaffold,
      didCheck: !!body.didCheck,
      errorCount: Number(body.errorCount ?? 0),
      note: body.note,
    });
    return NextResponse.json(task);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
