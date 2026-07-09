import type { NutritionTotals } from "@/lib/nutrition";
import type { SettingsRow } from "@/lib/db/queries";

function Meter({ label, value, target, unit }: { label: string; value: number; target: number | null; unit: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="flex-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-stone-500">{label}</span>
        <span className="font-medium text-stone-700">
          {Math.round(value)}
          {target ? `/${Math.round(target)}` : ""}{unit}
        </span>
      </div>
      {target && (
        <div className="mt-1 h-1.5 rounded-full bg-stone-200">
          <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function MacroSummary({ totals, prefs }: { totals: NutritionTotals; prefs: SettingsRow }) {
  const over = prefs.calorieTarget != null && totals.calories > prefs.calorieTarget;
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{Math.round(totals.calories).toLocaleString()}</span>
        <span className="text-sm text-stone-500">
          kcal today{prefs.calorieTarget ? ` · target ${Math.round(prefs.calorieTarget).toLocaleString()}` : ""}
        </span>
      </div>
      {prefs.calorieTarget != null && (
        <div className="mt-2 h-2 rounded-full bg-stone-200">
          <div
            className="h-2 rounded-full bg-emerald-600"
            style={{ width: `${Math.min(100, (totals.calories / prefs.calorieTarget) * 100)}%` }}
          />
        </div>
      )}
      {over && <p className="mt-1 text-xs text-stone-500">A little over today — that's okay, it's just information.</p>}
      <div className="mt-3 flex gap-4">
        <Meter label="Protein" value={totals.protein_g} target={prefs.proteinTarget} unit="g" />
        <Meter label="Carbs" value={totals.carbs_g} target={prefs.carbsTarget} unit="g" />
        <Meter label="Fat" value={totals.fat_g} target={prefs.fatTarget} unit="g" />
      </div>
    </section>
  );
}
