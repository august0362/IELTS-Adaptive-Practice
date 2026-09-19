import { NextResponse } from "next/server";
import { getSkillsWithParts } from "@/lib/db/queries";

export async function GET() {
  const allSkills = await getSkillsWithParts();
  return NextResponse.json(allSkills);
}
