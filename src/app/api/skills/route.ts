import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

export async function GET() {
  const allSkills = await db.query.skills.findMany({ with: { parts: true } });
  return NextResponse.json(allSkills);
}
