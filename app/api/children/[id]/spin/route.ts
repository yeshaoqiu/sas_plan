import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSpinStatus, spinDaily } from "@/lib/repositories/growth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const date = new URL(req.url).searchParams.get("date") ?? "";
  const status = getSpinStatus(getDb(), Number(id), date);
  return NextResponse.json(status);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const date = String(body.date ?? "");
  const result = spinDaily(getDb(), Number(id), date, Math.random());
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ prize: result.prize });
}
