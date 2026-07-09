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
    <main className="space-y-4 p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Today</h1>
        <span className="text-sm text-stone-500">{formatDisplayDate(today)}</span>
      </header>

      <MacroSummary totals={totals} prefs={prefs} />

      <Link
        href="/add"
        className="block w-full rounded-xl bg-emerald-600 py-3 text-center font-semibold text-white shadow-sm"
      >
        📸 Add meal
      </Link>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-stone-500">Today&apos;s meals</h2>
        {mealsToday.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
            Nothing logged yet — snap your next meal!
          </p>
        ) : (
          mealsToday.map((m) => <MealCard key={m.id} meal={m} />)
        )}
      </section>

      {recentOther.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-stone-500">Recent meals</h2>
          {recentOther.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
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
        </section>
      )}

      <p className="text-center text-xs text-stone-400">All numbers are AI estimates — edit anything that looks off.</p>
    </main>
  );
}
