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
    <label className="flex items-center justify-between gap-3 border-b border-line py-3">
      <span>{label}</span>
      <span className="flex items-baseline gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value ?? ""}
          placeholder="—"
          onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
          className="w-24 rounded-none border-0 border-b border-line bg-transparent px-0 py-1 text-right font-display tabular-nums focus:border-ink focus:outline-none"
        />
        <span className="font-display text-[10px] uppercase tracking-[0.15em] text-ink-soft">{unit}</span>
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
    <div className="space-y-5">
      <div className="border-t border-line">
        <TargetField label="Daily calories" value={calorieTarget} onChange={setCalorieTarget} unit="kcal" />
        <TargetField label="Protein" value={proteinTarget} onChange={setProteinTarget} unit="g" />
        <TargetField label="Carbs" value={carbsTarget} onChange={setCarbsTarget} unit="g" />
        <TargetField label="Fat" value={fatTarget} onChange={setFatTarget} unit="g" />
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={status === "saving"}
        className="w-full bg-tomato py-3.5 font-display text-sm uppercase tracking-[0.2em] text-paper disabled:opacity-50"
      >
        {status === "saving" ? "Saving…" : "Save targets"}
      </button>
      {status === "saved" && <p className="text-center text-sm italic text-ink-soft">Saved.</p>}
      {status === "error" && <p className="text-center text-sm italic text-tomato">Couldn&apos;t save — try again.</p>}
    </div>
  );
}
