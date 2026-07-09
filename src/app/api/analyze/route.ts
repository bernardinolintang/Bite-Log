import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeMeal } from "@/lib/ai/analyze";
import { applyFoodMemory } from "@/lib/food-memory";
import { getAllFoodTemplates } from "@/lib/db/memory";
import { calcTotals } from "@/lib/nutrition";

export const maxDuration = 30;

const bodySchema = z
  .object({
    image: z.string().startsWith("data:image/").max(2_000_000).optional(),
    description: z.string().trim().max(2000).optional(),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    clarifications: z
      .array(z.object({ question: z.string().max(500), answer: z.string().max(500) }))
      .max(6)
      .optional(),
  })
  .refine((b) => b.image || (b.description && b.description.length > 0), {
    message: "Provide a photo or a description",
  });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a photo or a description." }, { status: 400 });
  }
  const { image, description, mealType, clarifications } = parsed.data;
  try {
    const analysis = await analyzeMeal({ imageDataUrl: image, description, mealType, clarifications });
    const templates = await getAllFoodTemplates();
    const items = applyFoodMemory(analysis.items, templates);
    return NextResponse.json({ ...analysis, items, totals: calcTotals(items) });
  } catch (err) {
    console.error("analyze failed:", err);
    return NextResponse.json(
      { error: "The AI couldn't analyze this meal. Try again, or enter it manually." },
      { status: 502 },
    );
  }
}
