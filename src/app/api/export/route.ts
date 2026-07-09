import { NextResponse } from "next/server";
import { getAllMealsWithItems, getSettings } from "@/lib/db/queries";
import { getAllFoodTemplates } from "@/lib/db/memory";
import { db } from "@/lib/db";
import { savedMeals } from "@/lib/db/schema";

export async function GET() {
  const [meals, settings, foodTemplates, quickLogs] = await Promise.all([
    getAllMealsWithItems(),
    getSettings(),
    getAllFoodTemplates(),
    db.query.savedMeals.findMany(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    settings,
    meals: meals.map((m) => ({
      ...m,
      items: m.items.map((i) => ({
        foodName: i.foodName,
        quantityDesc: i.quantityDesc,
        grams: i.grams,
        calories: i.calories,
        proteinG: i.proteinG,
        carbsG: i.carbsG,
        fatG: i.fatG,
        fibreG: i.fibreG,
        sodiumMg: i.sodiumMg,
        confidence: i.confidence,
        assumptions: i.assumptions,
      })),
    })),
    foodTemplates,
    savedMeals: quickLogs,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="bitelog-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
