import { desc, eq } from "drizzle-orm";
import { db } from "./index";
import { mealItems, meals, settings, foodTemplates, savedMeals } from "./schema";

export type MealRow = typeof meals.$inferSelect;
export type MealItemRow = typeof mealItems.$inferSelect;
export type MealWithItems = MealRow & { items: MealItemRow[] };
export type SettingsRow = typeof settings.$inferSelect;
export type FoodTemplateRow = typeof foodTemplates.$inferSelect;
export type SavedMealRow = typeof savedMeals.$inferSelect;

export async function getMealsByDate(date: string): Promise<MealWithItems[]> {
  return db.query.meals.findMany({
    where: eq(meals.loggedDate, date),
    with: { items: true },
    orderBy: [desc(meals.loggedAt)],
  });
}

export async function getMealWithItems(id: string): Promise<MealWithItems | undefined> {
  return db.query.meals.findFirst({ where: eq(meals.id, id), with: { items: true } });
}

export async function getRecentMeals(limit = 8): Promise<MealWithItems[]> {
  return db.query.meals.findMany({
    with: { items: true },
    orderBy: [desc(meals.loggedAt)],
    limit,
  });
}

export async function getAllMealsWithItems(limit = 500): Promise<MealWithItems[]> {
  return db.query.meals.findMany({
    with: { items: true },
    orderBy: [desc(meals.loggedAt)],
    limit,
  });
}

const DEFAULT_SETTINGS: SettingsRow = {
  id: 1,
  calorieTarget: null,
  proteinTarget: null,
  carbsTarget: null,
  fatTarget: null,
};

export async function getSettings(): Promise<SettingsRow> {
  const row = await db.query.settings.findFirst();
  if (row) return row;
  await db.insert(settings).values(DEFAULT_SETTINGS).onConflictDoNothing();
  return { ...DEFAULT_SETTINGS };
}
