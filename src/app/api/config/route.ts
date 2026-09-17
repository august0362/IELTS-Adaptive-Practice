import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { config as configTable } from "@/lib/db/schema";

async function currentConfigMap() {
  const rows = await db.select().from(configTable);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function GET() {
  return NextResponse.json(await currentConfigMap());
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { key, value } = body ?? {};

  if (typeof key !== "string" || key.length === 0 || value === undefined || value === null) {
    return NextResponse.json({ error: "key (string) and value are required" }, { status: 400 });
  }

  const existing = await db.query.config.findFirst({ where: eq(configTable.key, key) });
  if (!existing) {
    return NextResponse.json({ error: `Unknown config key: ${key}` }, { status: 404 });
  }

  await db.update(configTable).set({ value: String(value) }).where(eq(configTable.key, key));

  return NextResponse.json(await currentConfigMap());
}
