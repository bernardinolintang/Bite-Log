import Link from "next/link";
import MacroSummary from "@/components/MacroSummary";
import MealCard from "@/components/MealCard";
import QuickLogSection from "@/components/QuickLogSection";
import { dbItemToFoodItem } from "@/lib/convert";
import { getTopSavedMeals } from "@/lib/db/memory";
import { getMealsByDate, getSettings } from "@/lib/db/queries";
import { formatDisplayDate, todayString } from "@/lib/dates";
import { calcTotals } from "@/lib/nutrition";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const today = todayString();
  const [mealsToday, quickLogs, prefs] = await Promise.all([
    getMealsByDate(today),
    getTopSavedMeals(6),
    getSettings(),
  ]);
  const totals = calcTotals(mealsToday.flatMap((m) => m.items.map(dbItemToFoodItem)));

  return (
    <main className="space-y-6 p-5">
      <header className="flex items-baseline justify-between border-b-2 border-ink pb-3">
        <h1 className="font-display text-sm font-medium uppercase tracking-[0.25em]">Today</h1>
        <span className="italic text-ink-soft">{formatDisplayDate(today)}</span>
      </header>

      <MacroSummary totals={totals} prefs={prefs} />

      <Link
        href="/add"
        className="block w-full bg-tomato py-3.5 text-center font-display text-sm uppercase tracking-[0.2em] text-paper"
      >
        Add meal +
      </Link>

      <QuickLogSection savedMeals={quickLogs} />

      <section>
        <h2 className="font-display text-[11px] font-medium uppercase tracking-[0.25em] text-ink-soft">
          Today&apos;s meals
        </h2>
        {mealsToday.length === 0 ? (
          <p className="border-b border-line py-8 text-center italic text-ink-soft">
            Nothing logged yet — snap your next meal.
          </p>
        ) : (
          <div className="mt-1">
            {mealsToday.map((m) => (
              <MealCard key={m.id} meal={m} />
            ))}
          </div>
        )}
      </section>

      <p className="text-center text-sm italic text-ink-soft">
        All numbers are AI estimates — edit anything that looks off.
      </p>
    </main>
  );
}
