import Link from "next/link";
import TrendChart from "@/components/TrendChart";
import { dbItemToFoodItem } from "@/lib/convert";
import { getAllMealsWithItems, getSettings } from "@/lib/db/queries";
import { formatDisplayDate, lastNDates } from "@/lib/dates";
import { calcTotals, type NutritionTotals } from "@/lib/nutrition";

export const dynamic = "force-dynamic";

type DayBucket = { items: ReturnType<typeof dbItemToFoodItem>[]; count: number };

export default async function HistoryPage() {
  const [meals, prefs] = await Promise.all([getAllMealsWithItems(), getSettings()]);

  const byDate = new Map<string, DayBucket>();
  for (const meal of meals) {
    const bucket = byDate.get(meal.loggedDate) ?? { items: [], count: 0 };
    bucket.items.push(...meal.items.map(dbItemToFoodItem));
    bucket.count += 1;
    byDate.set(meal.loggedDate, bucket);
  }
  const totalsFor = new Map<string, NutritionTotals>(
    [...byDate.entries()].map(([date, bucket]) => [date, calcTotals(bucket.items)]),
  );

  const chartData = lastNDates(7).map((date) => ({
    date,
    calories: totalsFor.get(date)?.calories ?? 0,
  }));
  const days = [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <main className="space-y-4 p-4">
      <h1 className="text-xl font-bold">History</h1>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-stone-500">Last 7 days · kcal</h2>
        <TrendChart data={chartData} target={prefs.calorieTarget} />
      </section>

      {days.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
          No meals logged yet.
        </p>
      ) : (
        <section className="space-y-2">
          {days.map(([date, info]) => {
            const totals = totalsFor.get(date)!;
            return (
              <div
                key={date}
                className="flex items-baseline justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium">{formatDisplayDate(date)}</p>
                  <p className="text-xs text-stone-500">
                    {info.count} meal{info.count === 1 ? "" : "s"} · P {totals.protein_g}g · C {totals.carbs_g}g · F{" "}
                    {totals.fat_g}g
                  </p>
                </div>
                <span className="font-semibold">{Math.round(totals.calories)} kcal</span>
              </div>
            );
          })}
        </section>
      )}

      <p className="text-center text-xs text-stone-400">
        Trends are for awareness, not judgement. <Link href="/settings" className="underline">Adjust targets</Link>
      </p>
    </main>
  );
}
