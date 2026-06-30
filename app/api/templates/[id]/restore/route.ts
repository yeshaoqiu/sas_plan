import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { restoreTemplate } from "@/lib/repositories/templates";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  restoreTemplate(getDb(), Number(id));
  return NextResponse.json({ ok: true });
}
