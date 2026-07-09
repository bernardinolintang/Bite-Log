import type { NutritionTotals } from "@/lib/nutrition";
import type { SettingsRow } from "@/lib/db/queries";

function Meter({ label, value, target, unit }: { label: string; value: number; target: number | null; unit: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="flex-1">
      <p className="font-display text-[10px] uppercase tracking-[0.2em] text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-xl font-medium tabular-nums">
        {Math.round(value)}
        <span className="text-sm font-normal text-ink-soft">
          {target ? `/${Math.round(target)}` : ""}{unit}
        </span>
      </p>
      {target && (
        <div className="mt-1.5 h-0.5 bg-line">
          <div className="h-0.5 bg-tomato" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function MacroSummary({ totals, prefs }: { totals: NutritionTotals; prefs: SettingsRow }) {
  const over = prefs.calorieTarget != null && totals.calories > prefs.calorieTarget;
  return (
    <section className="border-b border-line pb-6">
      <div className="flex items-end gap-3">
        <span className="font-display text-7xl font-medium leading-[0.9] tracking-tight tabular-nums">
          {Math.round(totals.calories).toLocaleString()}
        </span>
        <span className="pb-1 italic leading-tight text-ink-soft">
          {prefs.calorieTarget
            ? `of ${Math.round(prefs.calorieTarget).toLocaleString()} kcal`
            : "kcal today"}
        </span>
      </div>
      {prefs.calorieTarget != null && (
        <div className="mt-4 h-0.5 bg-line">
          <div
            className="h-0.5 bg-tomato"
            style={{ width: `${Math.min(100, (totals.calories / prefs.calorieTarget) * 100)}%` }}
          />
        </div>
      )}
      {over && (
        <p className="mt-2 text-sm italic text-ink-soft">A little over today — that&apos;s okay, it&apos;s just information.</p>
      )}
      <div className="mt-5 flex gap-6">
        <Meter label="Protein" value={totals.protein_g} target={prefs.proteinTarget} unit="g" />
        <Meter label="Carbs" value={totals.carbs_g} target={prefs.carbsTarget} unit="g" />
        <Meter label="Fat" value={totals.fat_g} target={prefs.fatTarget} unit="g" />
      </div>
    </section>
  );
}
