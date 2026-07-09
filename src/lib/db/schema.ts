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

export const mealsRelations = relations(meals, ({ many }) => ({
  items: many(mealItems),
}));

export const mealItemsRelations = relations(mealItems, ({ one }) => ({
  meal: one(meals, { fields: [mealItems.mealId], references: [meals.id] }),
}));
