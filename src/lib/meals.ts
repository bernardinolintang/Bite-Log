import type { FoodItem } from "./ai/schema";
import { foodItemToDbValues } from "./convert";
import { dateStringFor } from "./dates";
import { db } from "./db";
import { rememberMealItems, rememberSavedMeal } from "./db/memory";
import { mealItems, meals } from "./db/schema";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type InputType = "photo" | "text" | "manual";

export interface SaveMealInput {
  mealType: MealType;
  inputType: InputType;
  description?: string | null;
  thumbnail?: string | null;
  aiSummary?: string | null;
  items: FoodItem[];
}

/** Persist a meal and fold it into the food/quick-log memory. Shared by the web UI and the bot. */
export async function saveMeal(input: SaveMealInput): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(meals).values({
    id,
    mealType: input.mealType,
    inputType: input.inputType,
    description: input.description ?? null,
    thumbnail: input.thumbnail ?? null,
    aiSummary: input.aiSummary ?? null,
    loggedAt: now,
    loggedDate: dateStringFor(now),
  });
  await db.insert(mealItems).values(input.items.map((i) => foodItemToDbValues(i, id)));
  await rememberMealItems(input.items);
  await rememberSavedMeal(input.items, input.mealType, input.aiSummary ?? null, input.thumbnail ?? null);
  return id;
}
