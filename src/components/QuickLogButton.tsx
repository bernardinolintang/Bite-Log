"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FoodItem } from "@/lib/ai/schema";
import type { SavedMealRow } from "@/lib/db/queries";
import { calcTotals } from "@/lib/nutrition";

function parseItems(json: string): FoodItem[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((i) => i && typeof i.food_name === "string");
  } catch {
    return [];
  }
}

export default function QuickLogButton({ saved }: { saved: SavedMealRow }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const items = parseItems(saved.itemsJson);
  const kcal = Math.round(calcTotals(items).calories);

  async function log() {
    if (items.length === 0) return;
    setBusy(true);
    const res = await fetch("/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mealType: saved.mealType,
        inputType: "manual",
        thumbnail: saved.thumbnail,
        aiSummary: saved.label,
        items,
      }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={() => void log()}
      disabled={busy || items.length === 0}
      className="flex min-w-[9rem] flex-col gap-1 border border-line bg-paper-deep p-3 text-left hover:border-ink disabled:opacity-50"
    >
      {saved.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={saved.thumbnail} alt="" className="mb-1 h-12 w-12 object-cover" />
      ) : null}
      <span className="line-clamp-2 text-sm font-medium leading-snug">{saved.label}</span>
      <span className="font-display text-[10px] uppercase tracking-[0.15em] text-ink-soft">
        {busy ? "Logging…" : `${kcal} kcal · ×${saved.logCount}`}
      </span>
    </button>
  );
}
