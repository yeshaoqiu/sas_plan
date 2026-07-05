import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deleteTask } from "@/lib/repositories/tasks";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    deleteTask(getDb(), Number(id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
