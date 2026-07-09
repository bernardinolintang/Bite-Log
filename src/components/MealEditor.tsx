"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ItemsEditor from "@/components/ItemsEditor";
import type { FoodItem } from "@/lib/ai/schema";
import { calcTotals } from "@/lib/nutrition";

export default function MealEditor({ mealId, initialItems }: { mealId: string; initialItems: FoodItem[] }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<FoodItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const totals = calcTotals(items);

  async function saveEdits() {
    if (items.length === 0 || items.some((i) => !i.food_name.trim())) {
      setError("Keep at least one item, and give every item a name.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/meals/${mealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError("Couldn't save changes — try again.");
    }
  }

  return (
    <div className="space-y-4">
      {editing ? (
        <>
          <ItemsEditor items={items} onChange={setItems} />
          {error && <p className="text-sm italic text-tomato">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void saveEdits()}
              disabled={saving}
              className="flex-1 bg-tomato py-3 font-display text-sm uppercase tracking-[0.2em] text-paper disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setItems(initialItems);
                setEditing(false);
                setError("");
              }}
              className="border border-ink px-4 py-3 font-display text-[11px] uppercase tracking-[0.15em]"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <ul className="border-t border-line">
            {items.map((item, i) => (
              <li key={i} className="border-b border-line py-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{item.food_name}</span>
                  <span className="font-display font-medium tabular-nums">
                    {Math.round(item.calories)}
                    <span className="ml-1 text-xs font-normal text-ink-soft">kcal</span>
                  </span>
                </div>
                <p className="text-xs italic text-ink-soft">
                  {item.quantity_desc}
                  {item.grams ? ` · ${Math.round(item.grams)}g` : ""} · P {item.protein_g}g · C {item.carbs_g}g · F{" "}
                  {item.fat_g}g
                </p>
                {item.assumptions.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-xs italic text-ink-soft marker:text-tomato">
                    {item.assumptions.map((a, j) => (
                      <li key={j}>{a}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t-2 border-ink pt-3">
            <span className="font-display text-[11px] uppercase tracking-[0.25em] text-ink-soft">Total</span>
            <span className="flex items-baseline gap-2">
              <strong className="font-display text-2xl font-medium tabular-nums">{Math.round(totals.calories)}</strong>
              <span className="text-xs text-ink-soft">
                kcal · P {totals.protein_g}g · C {totals.carbs_g}g · F {totals.fat_g}g
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full border border-ink py-2.5 font-display text-[11px] uppercase tracking-[0.2em] hover:bg-ink hover:text-paper"
          >
            Edit items
          </button>
        </>
      )}
    </div>
  );
}
