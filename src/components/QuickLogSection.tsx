import QuickLogButton from "@/components/QuickLogButton";
import type { SavedMealRow } from "@/lib/db/queries";

export default function QuickLogSection({ savedMeals }: { savedMeals: SavedMealRow[] }) {
  if (savedMeals.length === 0) return null;
  return (
    <section>
      <h2 className="font-display text-[11px] font-medium uppercase tracking-[0.25em] text-ink-soft">
        Quick log
      </h2>
      <p className="mt-1 text-xs italic text-ink-soft">One tap to log a meal you&apos;ve had before.</p>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
        {savedMeals.map((s) => (
          <QuickLogButton key={s.id} saved={s} />
        ))}
      </div>
    </section>
  );
}
