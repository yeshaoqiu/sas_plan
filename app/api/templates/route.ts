import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createTemplate, listTemplates, listAllTemplates } from "@/lib/repositories/templates";

export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const db = getDb();
  return NextResponse.json(all ? listAllTemplates(db) : listTemplates(db));
}

export async function POST(req: Request) {
  const body = await req.json();
  try {
    const tpl = createTemplate(getDb(), {
      name: body.name,
      subject: body.subject,
      defaultMinutes: Number(body.defaultMinutes),
      basePoints: Number(body.basePoints),
    });
    return NextResponse.json(tpl);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
