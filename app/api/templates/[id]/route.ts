import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { updateTemplate } from "@/lib/repositories/templates";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const tpl = updateTemplate(getDb(), Number(id), {
    name: body.name,
    subject: body.subject,
    defaultMinutes: Number(body.defaultMinutes),
    basePoints: Number(body.basePoints),
  });
  return NextResponse.json(tpl);
}
