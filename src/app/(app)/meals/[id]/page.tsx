import { notFound } from "next/navigation";
import DeleteMealButton from "@/components/DeleteMealButton";
import MealEditor from "@/components/MealEditor";
import { dbItemToFoodItem } from "@/lib/convert";
import { getMealWithItems } from "@/lib/db/queries";
import { formatDisplayDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function MealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meal = await getMealWithItems(id);
  if (!meal) notFound();

  return (
    <main className="space-y-5 p-5">
      <header className="border-b-2 border-ink pb-3">
        <h1 className="text-2xl font-medium">{meal.aiSummary || "Meal"}</h1>
        <p className="mt-1 font-display text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          {meal.mealType} · {formatDisplayDate(meal.loggedDate)}
        </p>
      </header>

      {meal.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meal.thumbnail} alt="Meal photo" className="w-full" />
      )}

      {meal.description && (
        <p className="border-l-2 border-tomato pl-4 text-sm italic text-ink-soft">&ldquo;{meal.description}&rdquo;</p>
      )}

      <MealEditor mealId={meal.id} initialItems={meal.items.map(dbItemToFoodItem)} />

      <p className="text-center text-sm italic text-ink-soft">Estimates only — edit anything that looks off.</p>
      <DeleteMealButton mealId={meal.id} />
    </main>
  );
}
