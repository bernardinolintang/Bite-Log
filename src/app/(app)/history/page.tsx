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
    <main className="space-y-6 p-5">
      <header className="border-b-2 border-ink pb-3">
        <h1 className="font-display text-sm font-medium uppercase tracking-[0.25em]">History</h1>
      </header>

      <section className="border-b border-line pb-4">
        <h2 className="mb-3 font-display text-[11px] font-medium uppercase tracking-[0.25em] text-ink-soft">
          Last 7 days · kcal
        </h2>
        <TrendChart data={chartData} target={prefs.calorieTarget} />
      </section>

      {days.length === 0 ? (
        <p className="border-b border-line py-8 text-center italic text-ink-soft">No meals logged yet.</p>
      ) : (
        <section>
          {days.map(([date, info]) => {
            const totals = totalsFor.get(date)!;
            return (
              <div key={date} className="flex items-baseline justify-between border-b border-line py-3.5">
                <div>
                  <p className="font-medium">{formatDisplayDate(date)}</p>
                  <p className="text-xs italic text-ink-soft">
                    {info.count} meal{info.count === 1 ? "" : "s"} · P {totals.protein_g}g · C {totals.carbs_g}g · F{" "}
                    {totals.fat_g}g
                  </p>
                </div>
                <span className="font-display text-lg font-medium tabular-nums">
                  {Math.round(totals.calories)}
                  <span className="ml-1 text-xs font-normal text-ink-soft">kcal</span>
                </span>
              </div>
            );
          })}
        </section>
      )}

      <p className="text-center text-sm italic text-ink-soft">
        Trends are for awareness, not judgement.{" "}
        <Link href="/settings" className="underline underline-offset-4">
          Adjust targets
        </Link>
      </p>
    </main>
  );
}
