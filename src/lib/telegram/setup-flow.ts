import type { ProfileRow } from "@/lib/db/queries";
import { ACTIVITY_LABELS, type ActivityLevel } from "@/lib/energy";
import type { InlineButton } from "./api";

export type StepId = "sex" | "age" | "height" | "weight" | "activity" | "target";

export interface Step {
  id: StepId;
  /** Which profile column it fills. */
  field: keyof ProfileRow;
  question: string;
  /** Free-text answers are numbers in this range; button steps have none. */
  range?: [number, number];
  buttons?: InlineButton[][];
}

const ACTIVITY_ORDER: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];

export const STEPS: Step[] = [
  {
    id: "sex",
    field: "sex",
    question: "First up — what should I use for the calculation?",
    buttons: [
      [
        { text: "Male", callback_data: "setup:sex:male" },
        { text: "Female", callback_data: "setup:sex:female" },
      ],
    ],
  },
  {
    id: "age",
    field: "birthYear",
    question: "How old are you? (just the number)",
    range: [13, 100],
  },
  {
    id: "height",
    field: "heightCm",
    question: "Your height in cm? (e.g. 178)",
    range: [100, 250],
  },
  {
    id: "weight",
    field: "weightKg",
    question: "And your weight in kg? (e.g. 72)",
    range: [25, 400],
  },
  {
    id: "activity",
    field: "activityLevel",
    question:
      "How active is a normal day for you, <b>not counting workouts</b>? " +
      "(I add those on top, so don't double-count them.)",
    buttons: ACTIVITY_ORDER.map((l) => [
      { text: `${l.replace("_", " ")} — ${ACTIVITY_LABELS[l]}`, callback_data: `setup:activity:${l}` },
    ]),
  },
  {
    id: "target",
    field: "targetDeficit",
    question: "Last one — how big a daily deficit are you aiming for?",
    buttons: [
      [
        { text: "300 (slow)", callback_data: "setup:target:300" },
        { text: "500 (steady)", callback_data: "setup:target:500" },
      ],
      [
        { text: "750 (fast)", callback_data: "setup:target:750" },
        { text: "Skip", callback_data: "setup:target:0" },
      ],
    ],
  },
];

export function stepById(id: string): Step | undefined {
  return STEPS.find((s) => s.id === id);
}

/** The first step whose profile field is still empty, or null when complete. */
export function nextStep(p: ProfileRow, from = 0): Step | null {
  for (let i = from; i < STEPS.length; i++) {
    const s = STEPS[i];
    if (p[s.field] === null || p[s.field] === undefined) return s;
  }
  return null;
}

export function stepAfter(id: StepId, p: ProfileRow): Step | null {
  const i = STEPS.findIndex((s) => s.id === id);
  return i < 0 ? null : nextStep(p, i + 1);
}

/** Pull the first number out of a reply like "178cm" or "about 72 kg". */
export function parseNumber(text: string, range: [number, number]): number | null {
  const m = text.replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n >= range[0] && n <= range[1] ? n : null;
}

/** Steps store an age, but the profile stores a birth year so it stays correct over time. */
export function valueForField(step: Step, n: number, now = new Date()): number {
  return step.id === "age" ? now.getUTCFullYear() - Math.round(n) : n;
}
