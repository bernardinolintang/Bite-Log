import type { FoodItem } from "./ai/schema";
import type { MealItemRow } from "./db/queries";

export function dbItemToFoodItem(row: MealItemRow): FoodItem {
  let assumptions: string[] = [];
  try {
    const parsed = JSON.parse(row.assumptions ?? "[]");
    if (Array.isArray(parsed)) assumptions = parsed.filter((a) => typeof a === "string");
  } catch {
    // ignore malformed stored JSON
  }
  return {
    food_name: row.foodName,
    quantity_desc: row.quantityDesc,
    grams: row.grams,
    calories: row.calories,
    protein_g: row.proteinG,
    carbs_g: row.carbsG,
    fat_g: row.fatG,
    fibre_g: row.fibreG,
    sodium_mg: row.sodiumMg,
    confidence: row.confidence,
    assumptions,
  };
}

export function foodItemToDbValues(item: FoodItem, mealId: string) {
  return {
    id: crypto.randomUUID(),
    mealId,
    foodName: item.food_name,
    quantityDesc: item.quantity_desc,
    grams: item.grams,
    calories: item.calories,
    proteinG: item.protein_g,
    carbsG: item.carbs_g,
    fatG: item.fat_g,
    fibreG: item.fibre_g,
    sodiumMg: item.sodium_mg,
    confidence: item.confidence,
    assumptions: JSON.stringify(item.assumptions),
  };
}
