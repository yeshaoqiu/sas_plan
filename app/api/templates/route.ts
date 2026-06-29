import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createTemplate, listTemplates } from "@/lib/repositories/templates";

export async function GET() {
  return NextResponse.json(listTemplates(getDb()));
}

export async function POST(req: Request) {
  const body = await req.json();
  const tpl = createTemplate(getDb(), {
    name: body.name,
    subject: body.subject,
    defaultMinutes: Number(body.defaultMinutes),
    basePoints: Number(body.basePoints),
  });
  return NextResponse.json(tpl);
}
