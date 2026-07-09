import Link from "next/link";
import { notFound } from "next/navigation";
import MealCard from "@/components/MealCard";
import MacroSummary from "@/components/MacroSummary";
import { dbItemToFoodItem } from "@/lib/convert";
import { getMealsByDate, getSettings } from "@/lib/db/queries";
import { formatDisplayDate } from "@/lib/dates";
import { calcTotals } from "@/lib/nutrition";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function HistoryDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const [meals, prefs] = await Promise.all([getMealsByDate(date), getSettings()]);
  const totals = calcTotals(meals.flatMap((m) => m.items.map(dbItemToFoodItem)));

  return (
    <main className="space-y-6 p-5">
      <header className="border-b-2 border-ink pb-3">
        <Link href="/history" className="text-xs italic text-ink-soft underline underline-offset-4">
          ← History
        </Link>
        <h1 className="mt-2 font-display text-sm font-medium uppercase tracking-[0.25em]">
          {formatDisplayDate(date)}
        </h1>
      </header>

      <MacroSummary totals={totals} prefs={prefs} />

      {meals.length === 0 ? (
        <p className="border-b border-line py-8 text-center italic text-ink-soft">No meals logged this day.</p>
      ) : (
        <section>
          <h2 className="font-display text-[11px] font-medium uppercase tracking-[0.25em] text-ink-soft">
            {meals.length} meal{meals.length === 1 ? "" : "s"}
          </h2>
          <div className="mt-1">
            {meals.map((m) => (
              <MealCard key={m.id} meal={m} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
