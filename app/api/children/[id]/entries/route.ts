import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listEntries } from "@/lib/repositories/points";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(listEntries(getDb(), Number(id)));
}
