import { desc, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  checkins,
  mealItems,
  meals,
  settings,
  foodTemplates,
  savedMeals,
  telegramChats,
} from "./schema";

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

export async function getMealsForDates(dates: string[]): Promise<MealWithItems[]> {
  if (dates.length === 0) return [];
  return db.query.meals.findMany({
    where: inArray(meals.loggedDate, dates),
    with: { items: true },
    orderBy: [desc(meals.loggedAt)],
  });
}

export async function deleteMeal(id: string): Promise<void> {
  await db.delete(meals).where(eq(meals.id, id));
}

/* ---------- Telegram ---------- */

export type TelegramChatRow = typeof telegramChats.$inferSelect;

export async function getLinkedChat(): Promise<TelegramChatRow | undefined> {
  return db.query.telegramChats.findFirst();
}

/**
 * Bind the bot to a chat if none is bound yet. Returns the chat that owns the bot,
 * so a second person running /start is told no rather than taking it over.
 */
export async function claimChat(chatId: string, username: string | null): Promise<TelegramChatRow> {
  const existing = await getLinkedChat();
  if (existing) return existing;
  const row = { id: 1, chatId, username, linkedAt: Date.now() };
  await db.insert(telegramChats).values(row).onConflictDoNothing();
  return (await getLinkedChat()) ?? row;
}

export async function unlinkChat(): Promise<void> {
  await db.delete(telegramChats);
}

/**
 * Claims a check-in slot for a date. Returns false when it was already claimed, so two
 * overlapping scheduler runs cannot both send. The primary key does the arbitrating.
 */
export async function markCheckinSent(date: string, slot: string): Promise<boolean> {
  const res = await db
    .insert(checkins)
    .values({ id: `${date}:${slot}`, slot, sentAt: Date.now() })
    .onConflictDoNothing();
  return res.rowsAffected > 0;
}
