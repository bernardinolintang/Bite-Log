import { desc, eq, sql } from "drizzle-orm";
import type { FoodItem } from "../ai/schema";
import { dbItemToFoodItem } from "../convert";
import { foodItemToTemplateRow, mealFingerprint, mealLabel } from "../food-memory";
import { db } from "./index";
import { foodTemplates, meals, savedMeals } from "./schema";

export async function getAllFoodTemplates() {
  const rows = await db.query.foodTemplates.findMany({ orderBy: [desc(foodTemplates.useCount)] });
  if (rows.length > 0) return rows;
  await backfillFoodTemplatesFromHistory();
  return db.query.foodTemplates.findMany({ orderBy: [desc(foodTemplates.useCount)] });
}

export async function getTopSavedMeals(limit = 6) {
  const rows = await db.query.savedMeals.findMany({
    orderBy: [desc(savedMeals.logCount), desc(savedMeals.lastLoggedAt)],
    limit,
  });
  if (rows.length > 0) return rows;
  await backfillSavedMealsFromHistory();
  return db.query.savedMeals.findMany({
    orderBy: [desc(savedMeals.logCount), desc(savedMeals.lastLoggedAt)],
    limit,
  });
}

async function backfillFoodTemplatesFromHistory() {
  const items = await db.query.mealItems.findMany({ with: { meal: true } });
  for (const item of items) {
    const food = dbItemToFoodItem(item);
    const row = foodItemToTemplateRow(food, item.meal?.loggedAt ?? Date.now());
    if (!row) continue;
    await db
      .insert(foodTemplates)
      .values({ ...row, useCount: 1 })
      .onConflictDoUpdate({
        target: foodTemplates.foodKey,
        set: {
          foodName: row.foodName,
          quantityDesc: row.quantityDesc,
          grams: row.grams,
          calories: row.calories,
          proteinG: row.proteinG,
          carbsG: row.carbsG,
          fatG: row.fatG,
          fibreG: row.fibreG,
          sodiumMg: row.sodiumMg,
          useCount: sql`${foodTemplates.useCount} + 1`,
          updatedAt: row.updatedAt,
        },
      });
  }
}

async function backfillSavedMealsFromHistory() {
  const allMeals = await db.query.meals.findMany({ with: { items: true }, orderBy: [desc(meals.loggedAt)] });
  const groups = new Map<
    string,
    { items: FoodItem[]; mealType: string; label: string; thumbnail: string | null; count: number; lastLoggedAt: number }
  >();
  for (const meal of allMeals) {
    const items = meal.items.map(dbItemToFoodItem);
    const fingerprint = mealFingerprint(items);
    if (!fingerprint) continue;
    const existing = groups.get(fingerprint);
    if (existing) {
      existing.count += 1;
      existing.lastLoggedAt = Math.max(existing.lastLoggedAt, meal.loggedAt);
      if (!existing.thumbnail && meal.thumbnail) existing.thumbnail = meal.thumbnail;
    } else {
      groups.set(fingerprint, {
        items,
        mealType: meal.mealType,
        label: mealLabel(meal.aiSummary, items),
        thumbnail: meal.thumbnail,
        count: 1,
        lastLoggedAt: meal.loggedAt,
      });
    }
  }
  for (const [fingerprint, group] of groups) {
    await db.insert(savedMeals).values({
      id: crypto.randomUUID(),
      fingerprint,
      label: group.label,
      mealType: group.mealType,
      thumbnail: group.thumbnail,
      itemsJson: JSON.stringify(group.items),
      logCount: group.count,
      lastLoggedAt: group.lastLoggedAt,
    }).onConflictDoNothing();
  }
}

export async function rememberMealItems(items: FoodItem[]) {
  const now = Date.now();
  for (const item of items) {
    const row = foodItemToTemplateRow(item, now);
    if (!row) continue;
    await db
      .insert(foodTemplates)
      .values(row)
      .onConflictDoUpdate({
        target: foodTemplates.foodKey,
        set: {
          foodName: row.foodName,
          quantityDesc: row.quantityDesc,
          grams: row.grams,
          calories: row.calories,
          proteinG: row.proteinG,
          carbsG: row.carbsG,
          fatG: row.fatG,
          fibreG: row.fibreG,
          sodiumMg: row.sodiumMg,
          useCount: sql`${foodTemplates.useCount} + 1`,
          updatedAt: now,
        },
      });
  }
}

export async function rememberSavedMeal(
  items: FoodItem[],
  mealType: string,
  aiSummary: string | null | undefined,
  thumbnail: string | null | undefined,
) {
  const fingerprint = mealFingerprint(items);
  if (!fingerprint) return;
  const now = Date.now();
  const label = mealLabel(aiSummary, items);
  const itemsJson = JSON.stringify(items);
  const existing = await db.query.savedMeals.findFirst({ where: eq(savedMeals.fingerprint, fingerprint) });
  if (existing) {
    await db
      .update(savedMeals)
      .set({
        label,
        mealType,
        thumbnail: thumbnail ?? existing.thumbnail,
        itemsJson,
        logCount: existing.logCount + 1,
        lastLoggedAt: now,
      })
      .where(eq(savedMeals.id, existing.id));
    return;
  }
  await db.insert(savedMeals).values({
    id: crypto.randomUUID(),
    fingerprint,
    label,
    mealType,
    thumbnail: thumbnail ?? null,
    itemsJson,
    logCount: 1,
    lastLoggedAt: now,
  });
}
