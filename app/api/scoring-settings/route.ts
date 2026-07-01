import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getScoringSettings, updateScoringSettings } from "@/lib/repositories/scoringSettings";

export async function GET() {
  return NextResponse.json(getScoringSettings(getDb()));
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const s = updateScoringSettings(getDb(), {
    onTimeBonus: Number(body.onTimeBonus),
    errorPenalty: Number(body.errorPenalty),
    minPoints: Number(body.minPoints),
  });
  return NextResponse.json(s);
}
