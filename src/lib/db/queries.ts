import { desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "./index";
import {
  activities,
  chatMessages,
  checkins,
  mealItems,
  meals,
  profile,
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

/* ---------- Profile & activities ---------- */

export type ProfileRow = typeof profile.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;

const EMPTY_PROFILE: ProfileRow = {
  id: 1,
  sex: null,
  birthYear: null,
  heightCm: null,
  weightKg: null,
  activityLevel: null,
  targetDeficit: null,
  updatedAt: 0,
};

export async function getProfile(): Promise<ProfileRow> {
  return (await db.query.profile.findFirst()) ?? { ...EMPTY_PROFILE };
}

/** Merge in whichever fields the user supplied, leaving the rest alone. */
export async function updateProfile(
  patch: Partial<Omit<ProfileRow, "id" | "updatedAt">>,
): Promise<ProfileRow> {
  const current = await getProfile();
  const next = { ...current, ...patch, id: 1, updatedAt: Date.now() };
  await db
    .insert(profile)
    .values(next)
    .onConflictDoUpdate({ target: profile.id, set: next });
  return next;
}

export async function addActivity(a: {
  source: string;
  externalId?: string | null;
  description: string;
  calories: number;
  loggedAt: number;
  loggedDate: string;
}): Promise<string | null> {
  const id = crypto.randomUUID();
  const res = await db
    .insert(activities)
    .values({ id, externalId: a.externalId ?? null, ...a })
    .onConflictDoNothing();
  // A conflict means an external source re-sent a workout we already have.
  return res.rowsAffected > 0 ? id : null;
}

export async function getActivitiesForDates(dates: string[]): Promise<ActivityRow[]> {
  if (dates.length === 0) return [];
  return db.query.activities.findMany({
    where: inArray(activities.loggedDate, dates),
    orderBy: [desc(activities.loggedAt)],
  });
}

export async function getRecentActivities(limit = 5): Promise<ActivityRow[]> {
  return db.query.activities.findMany({ orderBy: [desc(activities.loggedAt)], limit });
}

export async function deleteActivity(id: string): Promise<void> {
  await db.delete(activities).where(eq(activities.id, id));
}

/* ---------- Conversation memory ---------- */

export type ChatTurn = { role: "user" | "assistant"; content: string };

const HISTORY_LIMIT = 16;

/** Recent turns, oldest first — the order a chat model expects. */
export async function getRecentTurns(limit = HISTORY_LIMIT): Promise<ChatTurn[]> {
  const rows = await db.query.chatMessages.findMany({
    orderBy: [desc(chatMessages.createdAt)],
    limit,
  });
  return rows.reverse().map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
}

export async function appendTurn(role: "user" | "assistant", content: string): Promise<void> {
  if (!content.trim()) return;
  await db.insert(chatMessages).values({
    id: crypto.randomUUID(),
    role,
    // Long messages are summaries the model doesn't need in full.
    content: content.slice(0, 2000),
    createdAt: Date.now(),
  });
}

/** Drop anything older than the newest `keep` turns so the table can't grow forever. */
export async function pruneTurns(keep = 40): Promise<void> {
  const rows = await db.query.chatMessages.findMany({
    orderBy: [desc(chatMessages.createdAt)],
    limit: keep,
  });
  const oldest = rows[rows.length - 1];
  if (rows.length < keep || !oldest) return;
  await db.delete(chatMessages).where(lt(chatMessages.createdAt, oldest.createdAt));
}

export async function clearTurns(): Promise<void> {
  await db.delete(chatMessages);
}

/** Move an already-logged meal to a different day. */
export async function setMealDate(id: string, loggedAt: number, loggedDate: string): Promise<void> {
  await db.update(meals).set({ loggedAt, loggedDate }).where(eq(meals.id, id));
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
