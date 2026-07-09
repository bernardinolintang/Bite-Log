import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/db/queries";
import { settings } from "@/lib/db/schema";

const putSchema = z.object({
  calorieTarget: z.number().positive().max(20000).nullable(),
  proteinTarget: z.number().positive().max(2000).nullable(),
  carbsTarget: z.number().positive().max(2000).nullable(),
  fatTarget: z.number().positive().max(2000).nullable(),
});

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function PUT(req: NextRequest) {
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  await getSettings(); // ensure the row exists
  await db.update(settings).set(parsed.data).where(eq(settings.id, 1));
  return NextResponse.json({ ok: true });
}
