import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { foodItemSchema } from "@/lib/ai/schema";
import { saveMeal } from "@/lib/meals";

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
  const id = await saveMeal(parsed.data);
  return NextResponse.json({ id });
}
