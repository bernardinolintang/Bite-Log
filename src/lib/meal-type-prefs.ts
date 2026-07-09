const STORAGE_KEY = "bitelog-meal-type";
const VALID = new Set(["breakfast", "lunch", "dinner", "snack"]);

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}

export function loadMealType(): MealType {
  if (typeof window === "undefined") return defaultMealType();
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && VALID.has(stored) ? (stored as MealType) : defaultMealType();
}

export function saveMealType(type: MealType) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, type);
}
