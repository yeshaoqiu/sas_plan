import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listDailyPlan, addToDailyPlan, removeFromDailyPlan } from "@/lib/repositories/dailyPlan";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(listDailyPlan(getDb(), Number(id)));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  addToDailyPlan(getDb(), Number(id), Number(body.templateId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  removeFromDailyPlan(getDb(), Number(id), Number(body.templateId));
  return NextResponse.json({ ok: true });
}
