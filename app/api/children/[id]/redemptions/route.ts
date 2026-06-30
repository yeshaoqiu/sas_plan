import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listRedemptions } from "@/lib/repositories/points";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(listRedemptions(getDb(), Number(id)));
}
