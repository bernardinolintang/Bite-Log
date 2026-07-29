import type { FoodItem } from "@/lib/ai/schema";
import { dbItemToFoodItem } from "@/lib/convert";
import { formatDisplayDate } from "@/lib/dates";
import type { MealWithItems, SettingsRow } from "@/lib/db/queries";
import { calcTotals } from "@/lib/nutrition";
import { esc } from "./api";

const MEAL_EMOJI: Record<string, string> = {
  breakfast: "🍳",
  lunch: "🍜",
  dinner: "🍲",
  snack: "🍎",
};

const r = (n: number) => Math.round(n);

/** The breakdown shown right after a meal is logged. */
export function formatLoggedMeal(
  summary: string,
  mealType: string,
  items: FoodItem[],
  dayTotalCalories: number,
  target: number | null,
): string {
  const t = calcTotals(items);
  const lines: string[] = [];
  lines.push(`${MEAL_EMOJI[mealType] ?? "🍽"} <b>${esc(summary || mealType)}</b>`);
  lines.push("");
  for (const i of items) {
    const qty = i.quantity_desc ? ` <i>${esc(i.quantity_desc)}</i>` : "";
    lines.push(`• ${esc(i.food_name)}${qty} — <b>${r(i.calories)}</b> kcal`);
  }
  lines.push("");
  lines.push(`<b>${r(t.calories)} kcal</b>  ·  P ${r(t.protein_g)}g  C ${r(t.carbs_g)}g  F ${r(t.fat_g)}g`);
  lines.push(
    target
      ? `Today: <b>${r(dayTotalCalories)}</b> / ${r(target)} kcal  (${Math.max(0, r(target - dayTotalCalories))} left)`
      : `Today so far: <b>${r(dayTotalCalories)}</b> kcal`,
  );
  const lowConfidence = items.filter((i) => i.confidence < 0.6);
  if (lowConfidence.length) {
    lines.push("");
    lines.push(`<i>Rough guess on: ${esc(lowConfidence.map((i) => i.food_name).join(", "))}. Tell me more and I'll redo it.</i>`);
  }
  return lines.join("\n");
}

/** The /today summary and the evening wrap-up. */
export function formatDaySummary(
  meals: MealWithItems[],
  prefs: SettingsRow,
  heading = "Today",
): string {
  if (meals.length === 0) {
    return heading === "Today"
      ? "Nothing logged yet today. Send me a photo whenever you eat 🙂"
      : `Nothing logged for ${heading.toLowerCase()}.`;
  }
  const all = meals.flatMap((m) => m.items.map(dbItemToFoodItem));
  const t = calcTotals(all);
  const lines: string[] = [`<b>${esc(heading)}</b>`, ""];
  // Oldest first reads like a timeline; the query returns newest first.
  for (const m of [...meals].reverse()) {
    const mt = calcTotals(m.items.map(dbItemToFoodItem));
    const label = m.aiSummary || m.description || m.mealType;
    lines.push(`${MEAL_EMOJI[m.mealType] ?? "🍽"} ${esc(label)} — <b>${r(mt.calories)}</b> kcal`);
  }
  lines.push("");
  lines.push(`<b>Total ${r(t.calories)} kcal</b>`);
  lines.push(`P ${r(t.protein_g)}g  ·  C ${r(t.carbs_g)}g  ·  F ${r(t.fat_g)}g`);
  if (prefs.calorieTarget) {
    const left = prefs.calorieTarget - t.calories;
    lines.push(
      left >= 0
        ? `<b>${r(left)} kcal</b> left of ${r(prefs.calorieTarget)}`
        : `<b>${r(-left)} kcal</b> over ${r(prefs.calorieTarget)} — no drama, just information.`,
    );
  }
  return lines.join("\n");
}

/** Per-day calorie totals across a date range, for the "last 7 days" button. */
export function formatWeekSummary(
  meals: MealWithItems[],
  dates: string[],
  prefs: SettingsRow,
): string {
  const byDate = new Map<string, MealWithItems[]>();
  for (const m of meals) {
    const list = byDate.get(m.loggedDate);
    if (list) list.push(m);
    else byDate.set(m.loggedDate, [m]);
  }
  const logged = dates.filter((d) => byDate.has(d));
  if (logged.length === 0) return "Nothing logged in the last 7 days.";

  const lines: string[] = ["<b>Last 7 days</b>", ""];
  let sum = 0;
  for (const d of dates) {
    const dayMeals = byDate.get(d);
    if (!dayMeals) {
      lines.push(`${formatDisplayDate(d)} — <i>nothing logged</i>`);
      continue;
    }
    const kcal = calcTotals(dayMeals.flatMap((m) => m.items.map(dbItemToFoodItem))).calories;
    sum += kcal;
    const flag = prefs.calorieTarget && kcal > prefs.calorieTarget ? " ▲" : "";
    lines.push(`${formatDisplayDate(d)} — <b>${r(kcal)}</b> kcal${flag}`);
  }
  lines.push("");
  lines.push(`Average on days you logged: <b>${r(sum / logged.length)}</b> kcal`);
  return lines.join("\n");
}

/** Compact plain-text log the question-answering model reads as context. */
export function mealsAsContext(meals: MealWithItems[]): string {
  if (meals.length === 0) return "(no meals logged)";
  return [...meals]
    .reverse()
    .map((m) => {
      const t = calcTotals(m.items.map(dbItemToFoodItem));
      const items = m.items
        .map((i) => `${i.foodName} ${i.quantityDesc} ${r(i.calories)}kcal`)
        .join("; ");
      return `${m.loggedDate} ${m.mealType}: ${m.aiSummary || m.description || ""} [${items}] = ${r(t.calories)}kcal P${r(t.protein_g)} C${r(t.carbs_g)} F${r(t.fat_g)}`;
    })
    .join("\n");
}
