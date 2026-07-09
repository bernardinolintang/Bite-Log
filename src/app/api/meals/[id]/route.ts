import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { foodItemSchema } from "@/lib/ai/schema";
import { foodItemToDbValues } from "@/lib/convert";
import { rememberMealItems } from "@/lib/db/memory";
import { db } from "@/lib/db";
import { mealItems, meals } from "@/lib/db/schema";

const patchSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  description: z.string().max(2000).nullish(),
  items: z.array(foodItemSchema).min(1).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await db.query.meals.findFirst({ where: eq(meals.id, id) });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  const d = parsed.data;
  if (d.mealType || d.description !== undefined) {
    await db
      .update(meals)
      .set({
        ...(d.mealType ? { mealType: d.mealType } : {}),
        ...(d.description !== undefined ? { description: d.description ?? null } : {}),
      })
      .where(eq(meals.id, id));
  }
  if (d.items) {
    await db.delete(mealItems).where(eq(mealItems.mealId, id));
    await db.insert(mealItems).values(d.items.map((i) => foodItemToDbValues(i, id)));
    await rememberMealItems(d.items);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db.delete(mealItems).where(eq(mealItems.mealId, id));
  await db.delete(meals).where(eq(meals.id, id));
  return NextResponse.json({ ok: true });
}
