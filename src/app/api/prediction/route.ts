import { NextResponse } from "next/server";
import { getPredictionData } from "@/lib/db/queries";

export async function GET() {
  const prediction = await getPredictionData();
  return NextResponse.json(prediction);
}
