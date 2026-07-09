import type { FoodItem } from "./ai/schema";
import type { FoodTemplateRow } from "./db/queries";

const SAVED_CORRECTION = "Based on your saved correction";

export function normalizeFoodKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function mealFingerprint(items: Pick<FoodItem, "food_name">[]): string {
  return [...items]
    .map((i) => normalizeFoodKey(i.food_name))
    .filter(Boolean)
    .sort()
    .join("|");
}

export function mealLabel(summary: string | null | undefined, items: FoodItem[]): string {
  if (summary?.trim()) return summary.trim();
  const names = items.map((i) => i.food_name.trim()).filter(Boolean);
  if (names.length === 0) return "Meal";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

export function applyFoodMemory(items: FoodItem[], templates: FoodTemplateRow[]): FoodItem[] {
  const byKey = new Map(templates.map((t) => [t.foodKey, t]));
  return items.map((item) => {
    const key = normalizeFoodKey(item.food_name);
    const template = byKey.get(key);
    if (!template) return item;
    const assumptions = [
      ...item.assumptions.filter((a) => a !== SAVED_CORRECTION),
      SAVED_CORRECTION,
    ];
    return {
      food_name: template.foodName,
      quantity_desc: template.quantityDesc,
      grams: template.grams,
      calories: template.calories,
      protein_g: template.proteinG,
      carbs_g: template.carbsG,
      fat_g: template.fatG,
      fibre_g: template.fibreG,
      sodium_mg: template.sodiumMg,
      confidence: 1,
      assumptions,
    };
  });
}

export function foodItemToTemplateRow(item: FoodItem, now = Date.now()) {
  const key = normalizeFoodKey(item.food_name);
  if (!key) return null;
  return {
    id: crypto.randomUUID(),
    foodKey: key,
    foodName: item.food_name.trim(),
    quantityDesc: item.quantity_desc || "1 serving",
    grams: item.grams,
    calories: item.calories,
    proteinG: item.protein_g,
    carbsG: item.carbs_g,
    fatG: item.fat_g,
    fibreG: item.fibre_g,
    sodiumMg: item.sodium_mg,
    useCount: 1,
    updatedAt: now,
  };
}

export function isLowConfidence(confidence: number): boolean {
  return confidence < 0.6;
}
