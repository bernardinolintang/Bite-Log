"use client";
import type { FoodItem } from "@/lib/ai/schema";

export function emptyItem(): FoodItem {
  return {
    food_name: "",
    quantity_desc: "1 serving",
    grams: null,
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fibre_g: null,
    sodium_mg: null,
    confidence: 1,
    assumptions: [],
  };
}

function NumberField({
  label,
  value,
  onChange,
  allowNull = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  allowNull?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-stone-500">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value ?? ""}
        onChange={(e) => {
          if (e.target.value === "") return onChange(allowNull ? null : 0);
          onChange(Math.max(0, Number(e.target.value)));
        }}
        className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-800"
      />
    </label>
  );
}

export default function ItemsEditor({
  items,
  onChange,
}: {
  items: FoodItem[];
  onChange: (items: FoodItem[]) => void;
}) {
  function update(index: number, patch: Partial<FoodItem>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-2">
            <input
              value={item.food_name}
              onChange={(e) => update(i, { food_name: e.target.value })}
              placeholder="Food name"
              className="flex-1 rounded-lg border border-stone-300 px-2 py-1.5 font-medium"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label="Remove item"
              className="px-2 py-1.5 text-stone-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-2 flex flex-col gap-1 text-xs text-stone-500">
              Portion
              <input
                value={item.quantity_desc}
                onChange={(e) => update(i, { quantity_desc: e.target.value })}
                placeholder="e.g. 1 bowl"
                className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-800"
              />
            </label>
            <NumberField label="Grams" value={item.grams} allowNull onChange={(v) => update(i, { grams: v })} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <NumberField label="kcal" value={item.calories} onChange={(v) => update(i, { calories: v ?? 0 })} />
            <NumberField label="Protein" value={item.protein_g} onChange={(v) => update(i, { protein_g: v ?? 0 })} />
            <NumberField label="Carbs" value={item.carbs_g} onChange={(v) => update(i, { carbs_g: v ?? 0 })} />
            <NumberField label="Fat" value={item.fat_g} onChange={(v) => update(i, { fat_g: v ?? 0 })} />
          </div>
          {item.confidence < 0.95 && (
            <p className="text-xs text-stone-400">AI confidence: {Math.round(item.confidence * 100)}%</p>
          )}
          {item.assumptions.length > 0 && (
            <ul className="list-disc pl-4 text-xs text-stone-400">
              {item.assumptions.map((a, j) => (
                <li key={j}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, emptyItem()])}
        className="w-full rounded-xl border border-dashed border-stone-300 py-2.5 text-sm text-stone-500"
      >
        + Add item
      </button>
    </div>
  );
}
