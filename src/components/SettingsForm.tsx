"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SettingsRow } from "@/lib/db/queries";

function TargetField({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unit: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value ?? ""}
          placeholder="—"
          onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
          className="w-24 rounded-lg border border-stone-300 px-2 py-1.5 text-right text-sm"
        />
        <span className="text-xs text-stone-500">{unit}</span>
      </span>
    </label>
  );
}

export default function SettingsForm({ initial }: { initial: SettingsRow }) {
  const [calorieTarget, setCalorieTarget] = useState(initial.calorieTarget);
  const [proteinTarget, setProteinTarget] = useState(initial.proteinTarget);
  const [carbsTarget, setCarbsTarget] = useState(initial.carbsTarget);
  const [fatTarget, setFatTarget] = useState(initial.fatTarget);
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">("");
  const router = useRouter();

  async function save() {
    setStatus("saving");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        calorieTarget: calorieTarget || null,
        proteinTarget: proteinTarget || null,
        carbsTarget: carbsTarget || null,
        fatTarget: fatTarget || null,
      }),
    }).catch(() => null);
    if (res?.ok) {
      setStatus("saved");
      router.refresh();
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      <TargetField label="Daily calories" value={calorieTarget} onChange={setCalorieTarget} unit="kcal" />
      <TargetField label="Protein" value={proteinTarget} onChange={setProteinTarget} unit="g" />
      <TargetField label="Carbs" value={carbsTarget} onChange={setCarbsTarget} unit="g" />
      <TargetField label="Fat" value={fatTarget} onChange={setFatTarget} unit="g" />
      <button
        type="button"
        onClick={() => void save()}
        disabled={status === "saving"}
        className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50"
      >
        {status === "saving" ? "Saving…" : "Save targets"}
      </button>
      {status === "saved" && <p className="text-center text-sm text-emerald-700">Saved ✓</p>}
      {status === "error" && <p className="text-center text-sm text-red-600">Couldn&apos;t save — try again.</p>}
    </div>
  );
}
