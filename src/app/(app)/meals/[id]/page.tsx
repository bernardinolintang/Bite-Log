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
    <main className="space-y-4 p-4">
      <header>
        <h1 className="text-xl font-bold">{meal.aiSummary || "Meal"}</h1>
        <p className="text-sm capitalize text-stone-500">
          {meal.mealType} · {formatDisplayDate(meal.loggedDate)}
        </p>
      </header>

      {meal.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meal.thumbnail} alt="Meal photo" className="w-full rounded-2xl" />
      )}

      {meal.description && <p className="text-sm text-stone-600">&ldquo;{meal.description}&rdquo;</p>}

      <MealEditor mealId={meal.id} initialItems={meal.items.map(dbItemToFoodItem)} />

      <p className="text-center text-xs text-stone-400">Estimates only — edit anything that looks off.</p>
      <DeleteMealButton mealId={meal.id} />
    </main>
  );
}
