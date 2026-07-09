"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ItemsEditor, { emptyItem } from "@/components/ItemsEditor";
import type { FoodItem } from "@/lib/ai/schema";
import type { Clarification } from "@/lib/ai/types";
import { prepareImage } from "@/lib/image";
import { calcTotals } from "@/lib/nutrition";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type Phase = "input" | "analyzing" | "review";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}

export default function AddMealPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("input");
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [description, setDescription] = useState("");
  const [large, setLarge] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [summary, setSummary] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [isManual, setIsManual] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const prepared = await prepareImage(file);
      setLarge(prepared.large);
      setThumb(prepared.thumb);
    } catch {
      setError("Couldn't read that image — try a different photo.");
    }
  }

  async function analyze(extra: Clarification[] = []) {
    const clars = [...clarifications, ...extra];
    setPhase("analyzing");
    setError("");
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: large ?? undefined,
        description: description.trim() || undefined,
        mealType,
        clarifications: clars.length ? clars : undefined,
      }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const data = res ? await res.json().catch(() => null) : null;
      setError(data?.error ?? "Analysis failed — check your connection and try again.");
      setPhase(items.length ? "review" : "input");
      return;
    }
    const data = await res.json();
    setItems(data.items);
    setSummary(data.meal_summary);
    setQuestions(data.clarification_questions ?? []);
    setAnswers({});
    setClarifications(clars);
    setIsManual(false);
    setPhase("review");
  }

  function refine() {
    const extra = questions
      .map((q, i) => ({ question: q, answer: (answers[i] ?? "").trim() }))
      .filter((c) => c.answer);
    if (extra.length) void analyze(extra);
  }

  function startManual() {
    setItems([emptyItem()]);
    setSummary("");
    setQuestions([]);
    setIsManual(true);
    setError("");
    setPhase("review");
  }

  async function save() {
    if (items.some((i) => !i.food_name.trim())) {
      setError("Every item needs a name.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mealType,
        inputType: large ? "photo" : isManual ? "manual" : "text",
        description: description.trim() || null,
        thumbnail: thumb,
        aiSummary: summary || null,
        items,
      }),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Couldn't save the meal — try again.");
    }
  }

  const totals = calcTotals(items);

  return (
    <main className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Add meal</h1>

      <div className="grid grid-cols-4 gap-1 rounded-xl bg-stone-200 p-1">
        {MEAL_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMealType(t)}
            className={`rounded-lg py-1.5 text-sm capitalize ${
              mealType === t ? "bg-white font-semibold shadow-sm" : "text-stone-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {phase === "input" && (
        <>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => onFile(e.target.files?.[0])} />
          <input ref={galleryRef} type="file" accept="image/*" hidden
            onChange={(e) => onFile(e.target.files?.[0])} />

          {thumb ? (
            <div className="relative overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb} alt="Meal preview" className="w-full" />
              <button
                type="button"
                onClick={() => { setLarge(null); setThumb(null); }}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-sm text-white"
              >
                ✕ Remove
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-2xl border border-stone-200 bg-white py-8 shadow-sm">
                <span className="text-3xl">📸</span>
                <span className="text-sm font-medium">Take photo</span>
              </button>
              <button type="button" onClick={() => galleryRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-2xl border border-stone-200 bg-white py-8 shadow-sm">
                <span className="text-3xl">🖼️</span>
                <span className="text-sm font-medium">Upload</span>
              </button>
            </div>
          )}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="…or describe the meal (e.g. 'chicken rice with iced milo')"
            rows={3}
            className="w-full rounded-2xl border border-stone-200 bg-white p-3 text-sm shadow-sm"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={() => void analyze()}
            disabled={!large && !description.trim()}
            className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-40"
          >
            Analyze with AI
          </button>
          <button type="button" onClick={startManual} className="w-full py-2 text-sm text-stone-500 underline">
            Enter manually instead
          </button>
          <p className="text-center text-xs text-stone-400">
            Photos are analyzed by AI and not stored — only a small thumbnail is kept.
          </p>
        </>
      )}

      {phase === "analyzing" && (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm text-stone-500">Analyzing your meal…</p>
        </div>
      )}

      {phase === "review" && (
        <>
          {summary && <p className="font-medium">{summary}</p>}
          <p className="text-xs text-stone-400">Estimates only — tap any number to correct it.</p>

          {questions.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">Quick questions to improve the estimate (optional):</p>
              {questions.map((q, i) => (
                <label key={i} className="block text-sm text-amber-900">
                  {q}
                  <input
                    value={answers[i] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm"
                  />
                </label>
              ))}
              <button type="button" onClick={refine}
                disabled={!Object.values(answers).some((a) => a.trim())}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
                Refine estimate
              </button>
            </div>
          )}

          <ItemsEditor items={items} onChange={setItems} />

          <div className="flex items-baseline justify-between rounded-2xl bg-stone-100 px-4 py-3">
            <span className="text-sm text-stone-500">Total</span>
            <span>
              <strong>{Math.round(totals.calories)} kcal</strong>
              <span className="ml-2 text-xs text-stone-500">
                P {totals.protein_g}g · C {totals.carbs_g}g · F {totals.fat_g}g
              </span>
            </span>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="button" onClick={() => void save()} disabled={saving || items.length === 0}
            className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-40">
            {saving ? "Saving…" : "Save meal"}
          </button>
          <button type="button" onClick={() => setPhase("input")} className="w-full py-2 text-sm text-stone-500 underline">
            Back
          </button>
        </>
      )}
    </main>
  );
}
