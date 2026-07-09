import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { foodItemSchema } from "@/lib/ai/schema";
import { foodItemToDbValues } from "@/lib/convert";
import { dateStringFor } from "@/lib/dates";
import { db } from "@/lib/db";
import { mealItems, meals } from "@/lib/db/schema";

const saveSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  inputType: z.enum(["photo", "text", "manual"]),
  description: z.string().max(2000).nullish(),
  thumbnail: z.string().startsWith("data:image/").max(200_000).nullish(),
  aiSummary: z.string().max(300).nullish(),
  items: z.array(foodItemSchema).min(1),
});

export async function POST(req: NextRequest) {
  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid meal data" }, { status: 400 });
  }
  const d = parsed.data;
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(meals).values({
    id,
    mealType: d.mealType,
    inputType: d.inputType,
    description: d.description ?? null,
    thumbnail: d.thumbnail ?? null,
    aiSummary: d.aiSummary ?? null,
    loggedAt: now,
    loggedDate: dateStringFor(now),
  });
  await db.insert(mealItems).values(d.items.map((i) => foodItemToDbValues(i, id)));
  return NextResponse.json({ id });
}
