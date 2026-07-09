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
    <div className="space-y-3">
      {editing ? (
        <>
          <ItemsEditor items={items} onChange={setItems} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void saveEdits()}
              disabled={saving}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-semibold text-white disabled:opacity-50"
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
              className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{item.food_name}</span>
                  <span className="text-sm font-semibold">{Math.round(item.calories)} kcal</span>
                </div>
                <p className="text-xs text-stone-500">
                  {item.quantity_desc}
                  {item.grams ? ` · ${Math.round(item.grams)}g` : ""} · P {item.protein_g}g · C {item.carbs_g}g · F{" "}
                  {item.fat_g}g
                </p>
                {item.assumptions.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-xs text-stone-400">
                    {item.assumptions.map((a, j) => (
                      <li key={j}>{a}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between rounded-2xl bg-stone-100 px-4 py-3">
            <span className="text-sm text-stone-500">Total</span>
            <span>
              <strong>{Math.round(totals.calories)} kcal</strong>
              <span className="ml-2 text-xs text-stone-500">
                P {totals.protein_g}g · C {totals.carbs_g}g · F {totals.fat_g}g
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full rounded-xl border border-stone-300 py-2.5 text-sm font-medium"
          >
            ✏️ Edit items
          </button>
        </>
      )}
    </div>
  );
}
