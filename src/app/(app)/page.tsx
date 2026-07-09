import Link from "next/link";
import MacroSummary from "@/components/MacroSummary";
import MealCard from "@/components/MealCard";
import RelogButton from "@/components/RelogButton";
import { dbItemToFoodItem } from "@/lib/convert";
import { getMealsByDate, getRecentMeals, getSettings } from "@/lib/db/queries";
import { formatDisplayDate, todayString } from "@/lib/dates";
import { calcTotals } from "@/lib/nutrition";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const today = todayString();
  const [mealsToday, recent, prefs] = await Promise.all([
    getMealsByDate(today),
    getRecentMeals(8),
    getSettings(),
  ]);
  const totals = calcTotals(mealsToday.flatMap((m) => m.items.map(dbItemToFoodItem)));
  const recentOther = recent.filter((m) => m.loggedDate !== today).slice(0, 3);

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

      {recentOther.length > 0 && (
        <section>
          <h2 className="font-display text-[11px] font-medium uppercase tracking-[0.25em] text-ink-soft">
            Recent meals
          </h2>
          <div className="mt-1">
            {recentOther.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <MealCard meal={m} />
                </div>
                <RelogButton
                  mealType={m.mealType}
                  aiSummary={m.aiSummary}
                  thumbnail={m.thumbnail}
                  items={m.items.map(dbItemToFoodItem)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-sm italic text-ink-soft">
        All numbers are AI estimates — edit anything that looks off.
      </p>
    </main>
  );
}
