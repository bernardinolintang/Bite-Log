import Link from "next/link";
import type { MealWithItems } from "@/lib/db/queries";

export default function MealCard({ meal }: { meal: MealWithItems }) {
  const kcal = Math.round(meal.items.reduce((a, i) => a + i.calories, 0));
  const title = meal.aiSummary || meal.items.map((i) => i.foodName).join(", ") || meal.description || "Meal";
  return (
    <Link
      href={`/meals/${meal.id}`}
      className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm"
    >
      {meal.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meal.thumbnail} alt="" className="h-14 w-14 rounded-xl object-cover" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-stone-100 text-2xl" aria-hidden>
          🍽️
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs capitalize text-stone-500">{meal.mealType}</p>
      </div>
      <span className="text-sm font-semibold">{kcal} kcal</span>
    </Link>
  );
}
