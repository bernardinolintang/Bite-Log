import type { FoodItem } from "@/lib/ai/schema";
import { dbItemToFoodItem } from "@/lib/convert";
import { formatDisplayDate } from "@/lib/dates";
import type { ActivityRow, MealWithItems, ProfileRow, SettingsRow } from "@/lib/db/queries";
import {
  ACTIVITY_LABELS,
  energyBalance,
  weeklyRateKg,
  type ActivityLevel,
  type Maintenance,
} from "@/lib/energy";
import { calcTotals } from "@/lib/nutrition";
import { esc } from "./api";

const MEAL_EMOJI: Record<string, string> = {
  breakfast: "🍳",
  lunch: "🍜",
  dinner: "🍲",
  snack: "🍎",
};

const r = (n: number) => Math.round(n);

/** The item bullets + macro line shared by the preview and the post-save breakdown. */
function itemBulletsAndMacros(items: FoodItem[]): string[] {
  const t = calcTotals(items);
  const lines: string[] = [];
  for (const i of items) {
    const qty = i.quantity_desc ? ` <i>${esc(i.quantity_desc)}</i>` : "";
    lines.push(`• ${esc(i.food_name)}${qty} — <b>${r(i.calories)}</b> kcal`);
  }
  lines.push("");
  lines.push(`<b>${r(t.calories)} kcal</b>  ·  P ${r(t.protein_g)}g  C ${r(t.carbs_g)}g  F ${r(t.fat_g)}g`);
  return lines;
}

function lowConfidenceNote(items: FoodItem[], followUp: string): string[] {
  const low = items.filter((i) => i.confidence < 0.6);
  if (!low.length) return [];
  return ["", `<i>Rough guess on: ${esc(low.map((i) => i.food_name).join(", "))}. ${followUp}</i>`];
}

/**
 * Shown right after analysis, before anything is saved. Deliberately doesn't
 * fold this meal into "today's total" — it isn't logged yet, so that would
 * read as already counted when it might still get edited or discarded.
 */
export function formatMealPreview(
  summary: string,
  mealType: string,
  items: FoodItem[],
  currentDayCalories: number,
  target: number | null,
): string {
  const t = calcTotals(items);
  const lines: string[] = [`👀 <b>${esc(summary || mealType)}</b> — does this look right?`, ""];
  lines.push(...itemBulletsAndMacros(items));
  const projected = currentDayCalories + t.calories;
  lines.push(
    target
      ? `Would bring today to <b>${r(projected)}</b> / ${r(target)} kcal`
      : `Would bring today to <b>${r(projected)}</b> kcal`,
  );
  lines.push(...lowConfidenceNote(items, "Worth double-checking before you log it."));
  lines.push("", "<i>Tap Log it if that's right — or just tell me what's wrong and I'll fix it.</i>");
  return lines.join("\n");
}

/** The breakdown shown right after a meal is actually saved. */
export function formatLoggedMeal(
  summary: string,
  mealType: string,
  items: FoodItem[],
  dayTotalCalories: number,
  target: number | null,
): string {
  const lines: string[] = [`${MEAL_EMOJI[mealType] ?? "🍽"} <b>${esc(summary || mealType)}</b>`, ""];
  lines.push(...itemBulletsAndMacros(items));
  lines.push(
    target
      ? `Today: <b>${r(dayTotalCalories)}</b> / ${r(target)} kcal  (${Math.max(0, r(target - dayTotalCalories))} left)`
      : `Today so far: <b>${r(dayTotalCalories)}</b> kcal`,
  );
  lines.push(...lowConfidenceNote(items, "Tell me more and I'll redo it."));
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

/** Per-day totals with macros across a date range, for the "last 7 days" button. */
export function formatWeekSummary(
  meals: MealWithItems[],
  dates: string[],
  prefs: SettingsRow,
  activities: ActivityRow[] = [],
): string {
  const byDate = new Map<string, MealWithItems[]>();
  for (const m of meals) {
    const list = byDate.get(m.loggedDate);
    if (list) list.push(m);
    else byDate.set(m.loggedDate, [m]);
  }
  const burnedByDate = new Map<string, number>();
  for (const a of activities) {
    burnedByDate.set(a.loggedDate, (burnedByDate.get(a.loggedDate) ?? 0) + a.calories);
  }
  const logged = dates.filter((d) => byDate.has(d));
  if (logged.length === 0) return "Nothing logged in the last 7 days.";

  const lines: string[] = ["<b>Last 7 days</b>", ""];
  const run = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const d of dates) {
    const dayMeals = byDate.get(d);
    if (!dayMeals) {
      lines.push(`<b>${formatDisplayDate(d)}</b> — <i>nothing logged</i>`);
      continue;
    }
    const t = calcTotals(dayMeals.flatMap((m) => m.items.map(dbItemToFoodItem)));
    run.calories += t.calories;
    run.protein_g += t.protein_g;
    run.carbs_g += t.carbs_g;
    run.fat_g += t.fat_g;
    const flag = prefs.calorieTarget && t.calories > prefs.calorieTarget ? " ▲" : "";
    const burned = burnedByDate.get(d);
    lines.push(
      `<b>${formatDisplayDate(d)}</b> — ${r(t.calories)} kcal${flag}${burned ? `  🔥 ${r(burned)}` : ""}`,
    );
    lines.push(`   P ${r(t.protein_g)}g · C ${r(t.carbs_g)}g · F ${r(t.fat_g)}g`);
  }
  const n = logged.length;
  lines.push("");
  lines.push(`<b>Daily average</b> over ${n} logged day${n === 1 ? "" : "s"}`);
  lines.push(
    `${r(run.calories / n)} kcal · P ${r(run.protein_g / n)}g · C ${r(run.carbs_g / n)}g · F ${r(run.fat_g / n)}g`,
  );
  return lines.join("\n");
}

/** The /balance view: eaten vs burned, and where the deficit sits. */
export function formatBalance(
  eaten: number,
  totals: { protein_g: number; carbs_g: number; fat_g: number },
  activities: ActivityRow[],
  maint: Maintenance | null,
  targetDeficit: number | null,
  heading = "Today",
): string {
  const burned = activities.reduce((a, x) => a + x.calories, 0);
  const lines: string[] = [`<b>${esc(heading)} — energy</b>`, ""];
  lines.push(`🍽 Eaten      <b>${r(eaten)}</b> kcal`);
  lines.push(`   P ${r(totals.protein_g)}g · C ${r(totals.carbs_g)}g · F ${r(totals.fat_g)}g`);

  if (activities.length) {
    lines.push("");
    lines.push(`🔥 Burned     <b>${r(burned)}</b> kcal`);
    for (const a of activities) lines.push(`   ${esc(a.description)} — ${r(a.calories)}`);
  }

  if (!maint) {
    lines.push("");
    lines.push("<i>Tell me your stats and I can work out your maintenance calories —");
    lines.push("e.g. \"I'm male, 27, 178cm, 72kg, lightly active\". Or use /profile.</i>");
    return lines.join("\n");
  }

  const b = energyBalance(eaten, maint.baseline, burned);
  lines.push("");
  lines.push(`⚡️ Maintenance <b>${r(b.baseline)}</b> kcal (before exercise)`);
  lines.push(`   Total out   <b>${r(b.out)}</b> kcal`);
  lines.push("");
  if (b.deficit >= 0) {
    lines.push(`✅ <b>${r(b.deficit)} kcal deficit</b>`);
  } else {
    lines.push(`📈 <b>${r(-b.deficit)} kcal surplus</b>`);
  }
  const rate = weeklyRateKg(b.deficit);
  if (rate !== 0) {
    lines.push(
      `<i>At this rate: ${rate > 0 ? "−" : "+"}${Math.abs(rate)} kg/week</i>`,
    );
  }
  if (targetDeficit) {
    const gap = b.deficit - targetDeficit;
    lines.push(
      gap >= 0
        ? `<i>Target was ${r(targetDeficit)} — you're ${r(gap)} past it.</i>`
        : `<i>Target was ${r(targetDeficit)} — ${r(-gap)} to go.</i>`,
    );
  }
  return lines.join("\n");
}

export function formatProfile(p: ProfileRow, maint: Maintenance | null): string {
  const unset = "<i>not set</i>";
  const lines = [
    "<b>Your profile</b>",
    "",
    `Sex: ${p.sex ?? unset}`,
    `Born: ${p.birthYear ?? unset}`,
    `Height: ${p.heightCm ? `${p.heightCm} cm` : unset}`,
    `Weight: ${p.weightKg ? `${p.weightKg} kg` : unset}`,
    `Daily activity: ${p.activityLevel ? `${p.activityLevel} — ${ACTIVITY_LABELS[p.activityLevel as ActivityLevel]}` : unset}`,
    `Target deficit: ${p.targetDeficit ? `${r(p.targetDeficit)} kcal/day` : unset}`,
  ];
  lines.push("");
  if (maint) {
    lines.push(`BMR (at rest): <b>${r(maint.bmr)}</b> kcal`);
    lines.push(`Maintenance: <b>${r(maint.baseline)}</b> kcal/day before exercise`);
    lines.push("");
    lines.push("<i>Workouts you log are added on top of maintenance, so pick the activity");
    lines.push("level that describes your day WITHOUT deliberate exercise.</i>");
  } else {
    lines.push("<i>Tell me the missing bits in one message and I'll work out your");
    lines.push("maintenance — e.g. \"male, born 1999, 178cm, 72kg, lightly active\".</i>");
  }
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
