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

export const mealsRelations = relations(meals, ({ many }) => ({
  items: many(mealItems),
}));

export const mealItemsRelations = relations(mealItems, ({ one }) => ({
  meal: one(meals, { fields: [mealItems.mealId], references: [meals.id] }),
}));
