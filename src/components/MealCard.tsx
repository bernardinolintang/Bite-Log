import Link from "next/link";
import type { MealWithItems } from "@/lib/db/queries";

export default function MealCard({ meal }: { meal: MealWithItems }) {
  const kcal = Math.round(meal.items.reduce((a, i) => a + i.calories, 0));
  const title = meal.aiSummary || meal.items.map((i) => i.foodName).join(", ") || meal.description || "Meal";
  return (
    <Link href={`/meals/${meal.id}`} className="flex items-center gap-4 border-b border-line py-3">
      {meal.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meal.thumbnail} alt="" className="h-14 w-14 object-cover" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center bg-paper-deep" aria-hidden>
          <div className="h-6 w-6 rounded-full border-2 border-tomato" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-ink-soft">{meal.mealType}</p>
      </div>
      <span className="font-display text-lg font-medium tabular-nums">
        {kcal}
        <span className="ml-1 text-xs font-normal text-ink-soft">kcal</span>
      </span>
    </Link>
  );
}
