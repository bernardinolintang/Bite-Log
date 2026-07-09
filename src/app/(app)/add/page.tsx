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

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 8a2 2 0 0 1 2-2h1.5l1.2-2h8.6l1.2 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="4" width="18" height="16" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M3 17l5-5 4 4 3-3 6 6" />
    </svg>
  );
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
    <main className="space-y-5 p-5">
      <header className="border-b-2 border-ink pb-3">
        <h1 className="font-display text-sm font-medium uppercase tracking-[0.25em]">Add meal</h1>
      </header>

      <div className="flex border-b border-line">
        {MEAL_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMealType(t)}
            className={`flex-1 border-b-2 pb-2 pt-1 font-display text-[11px] uppercase tracking-[0.15em] ${
              mealType === t ? "border-tomato text-tomato" : "border-transparent text-ink-soft"
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
            <div className="relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb} alt="Meal preview" className="w-full" />
              <button
                type="button"
                onClick={() => { setLarge(null); setThumb(null); }}
                className="absolute right-2 top-2 bg-ink/80 px-2.5 py-1 font-display text-[10px] uppercase tracking-[0.15em] text-paper"
              >
                ✕ Remove
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-3 border border-line py-8 text-ink hover:border-ink">
                <CameraIcon />
                <span className="font-display text-[11px] uppercase tracking-[0.18em]">Take photo</span>
              </button>
              <button type="button" onClick={() => galleryRef.current?.click()}
                className="flex flex-col items-center gap-3 border border-line py-8 text-ink hover:border-ink">
                <ImageIcon />
                <span className="font-display text-[11px] uppercase tracking-[0.18em]">Upload</span>
              </button>
            </div>
          )}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="…or describe the meal (e.g. 'chicken rice with iced milo')"
            rows={3}
            className="w-full rounded-none border border-line bg-transparent p-3 text-sm placeholder:italic placeholder:text-ink-soft/60 focus:border-ink focus:outline-none"
          />

          {error && <p className="text-sm italic text-tomato">{error}</p>}

          <button
            type="button"
            onClick={() => void analyze()}
            disabled={!large && !description.trim()}
            className="w-full bg-tomato py-3.5 font-display text-sm uppercase tracking-[0.2em] text-paper disabled:opacity-40"
          >
            Analyze with AI
          </button>
          <button type="button" onClick={startManual} className="w-full py-1 text-sm italic text-ink-soft underline underline-offset-4">
            Enter manually instead
          </button>
          <p className="text-center text-xs italic text-ink-soft">
            Photos are analyzed by AI and not stored — only a small thumbnail is kept.
          </p>
        </>
      )}

      {phase === "analyzing" && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="flex gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-tomato" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-tomato [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-tomato [animation-delay:300ms]" />
          </div>
          <p className="italic text-ink-soft">Reading your meal…</p>
        </div>
      )}

      {phase === "review" && (
        <>
          {summary && <p className="text-xl font-medium">{summary}</p>}
          <p className="text-sm italic text-ink-soft">Estimates only — tap any number to correct it.</p>

          {questions.length > 0 && (
            <div className="space-y-3 border-l-2 border-tomato pl-4">
              <p className="text-sm font-medium">A few questions to sharpen the estimate (optional):</p>
              {questions.map((q, i) => (
                <label key={i} className="block text-sm italic">
                  {q}
                  <input
                    value={answers[i] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                    className="mt-1 w-full rounded-none border-0 border-b border-line bg-transparent px-0 py-1 text-sm not-italic focus:border-ink focus:outline-none"
                  />
                </label>
              ))}
              <button type="button" onClick={refine}
                disabled={!Object.values(answers).some((a) => a.trim())}
                className="border border-tomato px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.15em] text-tomato hover:bg-tomato hover:text-paper disabled:opacity-40">
                Refine estimate
              </button>
            </div>
          )}

          <ItemsEditor items={items} onChange={setItems} />

          <div className="flex items-baseline justify-between border-t-2 border-ink pt-3">
            <span className="font-display text-[11px] uppercase tracking-[0.25em] text-ink-soft">Total</span>
            <span className="flex items-baseline gap-2">
              <strong className="font-display text-2xl font-medium tabular-nums">{Math.round(totals.calories)}</strong>
              <span className="text-xs text-ink-soft">
                kcal · P {totals.protein_g}g · C {totals.carbs_g}g · F {totals.fat_g}g
              </span>
            </span>
          </div>

          {error && <p className="text-sm italic text-tomato">{error}</p>}

          <button type="button" onClick={() => void save()} disabled={saving || items.length === 0}
            className="w-full bg-tomato py-3.5 font-display text-sm uppercase tracking-[0.2em] text-paper disabled:opacity-40">
            {saving ? "Saving…" : "Save meal"}
          </button>
          <button type="button" onClick={() => setPhase("input")} className="w-full py-1 text-sm italic text-ink-soft underline underline-offset-4">
            Back
          </button>
        </>
      )}
    </main>
  );
}
