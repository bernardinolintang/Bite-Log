import { relations } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const meals = sqliteTable("meals", {
  id: text("id").primaryKey(),
  mealType: text("meal_type").notNull(), // breakfast | lunch | dinner | snack
  inputType: text("input_type").notNull(), // photo | text | manual
  description: text("description"),
  thumbnail: text("thumbnail"), // small base64 JPEG data URL
  aiSummary: text("ai_summary"),
  loggedAt: integer("logged_at").notNull(), // epoch ms
  loggedDate: text("logged_date").notNull(), // YYYY-MM-DD in APP_TIMEZONE
});

export const mealItems = sqliteTable("meal_items", {
  id: text("id").primaryKey(),
  mealId: text("meal_id")
    .notNull()
    .references(() => meals.id, { onDelete: "cascade" }),
  foodName: text("food_name").notNull(),
  quantityDesc: text("quantity_desc").notNull(),
  grams: real("grams"),
  calories: real("calories").notNull(),
  proteinG: real("protein_g").notNull(),
  carbsG: real("carbs_g").notNull(),
  fatG: real("fat_g").notNull(),
  fibreG: real("fibre_g"),
  sodiumMg: real("sodium_mg"),
  confidence: real("confidence").notNull(), // 0..1
  assumptions: text("assumptions").notNull().default("[]"), // JSON string[]
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(), // always 1
  calorieTarget: real("calorie_target"),
  proteinTarget: real("protein_target"),
  carbsTarget: real("carbs_target"),
  fatTarget: real("fat_target"),
});

/** Personal food memory — nutrition values the user confirmed for a food name. */
export const foodTemplates = sqliteTable("food_templates", {
  id: text("id").primaryKey(),
  foodKey: text("food_key").notNull().unique(),
  foodName: text("food_name").notNull(),
  quantityDesc: text("quantity_desc").notNull(),
  grams: real("grams"),
  calories: real("calories").notNull(),
  proteinG: real("protein_g").notNull(),
  carbsG: real("carbs_g").notNull(),
  fatG: real("fat_g").notNull(),
  fibreG: real("fibre_g"),
  sodiumMg: real("sodium_mg"),
  useCount: integer("use_count").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
});

/** Quick-log templates derived from saved meals. */
export const savedMeals = sqliteTable("saved_meals", {
  id: text("id").primaryKey(),
  fingerprint: text("fingerprint").notNull().unique(),
  label: text("label").notNull(),
  mealType: text("meal_type").notNull(),
  thumbnail: text("thumbnail"),
  itemsJson: text("items_json").notNull(),
  logCount: integer("log_count").notNull().default(1),
  lastLoggedAt: integer("last_logged_at").notNull(),
});

/** The single Telegram chat allowed to use the bot — claimed by the first /start. */
export const telegramChats = sqliteTable("telegram_chats", {
  id: integer("id").primaryKey(), // always 1
  chatId: text("chat_id").notNull(),
  username: text("username"),
  linkedAt: integer("linked_at").notNull(),
});

/** Body stats used to estimate maintenance calories. Single row, id 1. */
export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey(), // always 1
  sex: text("sex"), // male | female
  birthYear: integer("birth_year"),
  heightCm: real("height_cm"),
  weightKg: real("weight_kg"),
  /** Daily life EXCLUDING logged workouts — those are added on top. */
  activityLevel: text("activity_level"),
  /** kcal/day the user wants to be under maintenance. */
  targetDeficit: real("target_deficit"),
  updatedAt: integer("updated_at").notNull(),
});

/** Calories burned through exercise, from the bot, Apple Health, or any other source. */
export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  source: text("source").notNull(), // telegram | shortcuts | manual | strava
  /** Dedupe key for external sources that may re-send the same workout. */
  externalId: text("external_id").unique(),
  description: text("description").notNull(),
  calories: real("calories").notNull(),
  loggedAt: integer("logged_at").notNull(),
  loggedDate: text("logged_date").notNull(),
});

/** Recent Telegram turns, so the assistant can follow a thread instead of answering blind. */
export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  role: text("role").notNull(), // user | assistant
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** One row per check-in actually sent, so a re-run of the scheduler cannot double-nag. */
export const checkins = sqliteTable("checkins", {
  id: text("id").primaryKey(), // `${YYYY-MM-DD}:${slot}`
  slot: text("slot").notNull(),
  sentAt: integer("sent_at").notNull(),
});

export const mealsRelations = relations(meals, ({ many }) => ({
  items: many(mealItems),
}));

export const mealItemsRelations = relations(mealItems, ({ one }) => ({
  meal: one(meals, { fields: [mealItems.mealId], references: [meals.id] }),
}));
