"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FoodItem } from "@/lib/ai/schema";

export default function RelogButton({
  mealType,
  aiSummary,
  thumbnail,
  items,
}: {
  mealType: string;
  aiSummary: string | null;
  thumbnail: string | null;
  items: FoodItem[];
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function relog() {
    setBusy(true);
    await fetch("/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealType, inputType: "manual", thumbnail, aiSummary, items }),
    }).catch(() => null);
    setBusy(false);
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={() => void relog()}
      disabled={busy}
      className="rounded-full border border-emerald-600 px-3 py-1 text-xs font-medium text-emerald-700 disabled:opacity-50"
    >
      {busy ? "Logging…" : "Log again"}
    </button>
  );
}
