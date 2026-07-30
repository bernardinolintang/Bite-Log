import { groqCompleter } from "@/lib/ai/analyze";
import type { ChatTurn } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/ai/types";
import { ACTIVITY_MULTIPLIERS, type ActivityLevel, type Sex } from "@/lib/energy";
import type { MealType } from "@/lib/meals";

export type Intent =
  | "log_meal"
  | "log_activity"
  | "set_profile"
  | "amend_date"
  | "correct_meal"
  | "converse";

export interface Routing {
  intent: Intent;
  /** 0 = today, -1 = yesterday. Applies to the meal or workout being logged. */
  dayOffset: number;
  /** Set only when the user names the meal explicitly ("yesterday's dinner"). */
  mealType: MealType | null;
  /** For log_activity: calories burned and what they did. */
  burnedCalories: number | null;
  activity: string | null;
  /** For set_profile: whichever body stats they mentioned. */
  profile: ProfilePatch | null;
}

export interface ProfilePatch {
  sex?: Sex;
  birthYear?: number;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: ActivityLevel;
  targetDeficit?: number;
}

const ROUTER_PROMPT = `You route messages sent to a personal health assistant that tracks
food eaten and calories burned.

Reply with ONLY a JSON object:
{"intent": "log_meal"|"log_activity"|"set_profile"|"amend_date"|"correct_meal"|"converse",
 "day_offset": number,
 "meal_type": "breakfast"|"lunch"|"dinner"|"snack"|null,
 "burned_calories": number|null,
 "activity": string|null,
 "profile": {"sex":"male"|"female","age":number,"birth_year":number,"height_cm":number,
             "weight_kg":number,
             "activity_level":"sedentary"|"light"|"moderate"|"active"|"very_active",
             "target_deficit":number} | null}

THE MOST IMPORTANT DISTINCTION: your previous message in this conversation is usually a meal
breakdown you just logged. If the user's new message disputes ANY part of it — the food, the
amount, an ingredient, a drink, or just says "wrong" or "no" — that is "correct_meal", NEVER
"log_meal". They are fixing your entry, not eating something new.

intent:
- "correct_meal": correcting WHAT the food was, or how much, in the entry you just logged.
  "that's not kaya toast, it's french toast" -> correct_meal
  "there were 3 slices not 2" -> correct_meal
  "the kopi was kopi-o kosong, no milk or sugar" -> correct_meal
  "you missed the butter" -> correct_meal
  "no egg, I didn't have that" -> correct_meal
  "wrong" / "that's off" / "nope" -> correct_meal
  Naming a food does NOT make it log_meal if it contradicts what you just said.
- "log_meal": they are telling you about food you have NOT already logged.
  "chicken rice", "I had two eggs and toast", "nasi lemak for lunch".
  Use this when it reads as a new, separate thing they ate — not a fix to your last entry.
- "log_activity": they are telling you about exercise or calories burned.
  "burnt 500 calories on incline walk", "ran 5k, about 400 cals", "did legs at the gym, 300kcal".
  Put the number in burned_calories and a short label in activity ("Incline walk").
  If they describe exercise without a number, still use log_activity with burned_calories null.
- "set_profile": they are giving body stats or a goal. ANY message describing their body,
  age, sex, height, weight or activity level is set_profile, never log_meal.
  "I'm male, 27, 178cm, 72kg, lightly active" ->
    {"intent":"set_profile","profile":{"sex":"male","age":27,"height_cm":178,"weight_kg":72,
     "activity_level":"light"}}
  "I weigh 70kg now" -> {"intent":"set_profile","profile":{"weight_kg":70}}
  "aim for a 500 deficit" -> {"intent":"set_profile","profile":{"target_deficit":500}}
  Use "age" when they give an age and "birth_year" when they give a year.
  Fill only the fields they actually mention; omit the rest.
- "amend_date": correcting the DAY of something already logged.
  "that was yesterday", "I told you the sausage platter was from yesterday".
  Only when they refer back to an earlier entry rather than naming new food.
- "converse": questions about their log, maintenance, deficit, or anything else.
  "what did I eat today?", "am I in a deficit?", "what's my maintenance", "ok nice", "thanks".

day_offset: 0 unless they say otherwise. "yesterday" or "last night" = -1. Only 0 or negative.
meal_type: only when stated outright, otherwise null.
Set unused fields to null.

A bare food name with no question mark is "log_meal" — unless it contradicts the breakdown
you just gave, in which case it is "correct_meal".`;

const PERSONA = `You are BiteLog, a warm, concise personal nutrition assistant chatting on Telegram.

- Talk like a friend who happens to keep their food diary. Natural, brief, never clinical.
- 1-3 short sentences usually. This is a phone screen, not a report.
- Use the meal log for every factual claim. Never invent food, numbers, or days.
- If the log doesn't cover what they asked, say so and offer to log it.
- Numbers are estimates — don't over-claim precision. Round calories to whole numbers.
- They are aiming for a calorie deficit. Report the numbers matter-of-factly: what they ate,
  what they burned, where the balance sits. State facts, not judgement.
- Never comment on their body, appearance, or discipline. No medical advice, no moralising
  about food choices. You are a record keeper, not a coach.
- Maintenance and burn figures are rough estimates from formulas and app data, not
  measurements. Say so if a question leans on their precision.
- Plain text only: no markdown, no asterisks, no headings, no bullet characters.
- Follow the conversation. If they refer to "that" or "it", look at what was just discussed.`;

function extractJson(raw: string): unknown {
  return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, ""));
}

const MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack"]);
// Must list every Intent — an unlisted one is silently downgraded to log_meal.
const INTENTS = new Set<Intent>([
  "log_meal",
  "log_activity",
  "set_profile",
  "amend_date",
  "correct_meal",
  "converse",
]);
const SEXES = new Set(["male", "female"]);
const LEVELS = new Set(Object.keys(ACTIVITY_MULTIPLIERS));

/** Keep an extracted number only if it lands in a physically sensible range. */
function inRange(v: unknown, lo: number, hi: number): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined;
}

function readProfile(raw: unknown): ProfilePatch | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const patch: ProfilePatch = {};
  if (typeof o.sex === "string" && SEXES.has(o.sex)) patch.sex = o.sex as Sex;
  const thisYear = new Date().getUTCFullYear();
  const year = inRange(o.birth_year, 1920, thisYear - 12);
  if (year !== undefined) patch.birthYear = Math.round(year);
  // People say "I'm 27" far more often than they give a birth year.
  const age = inRange(o.age, 13, 100);
  if (year === undefined && age !== undefined) patch.birthYear = thisYear - Math.round(age);
  const h = inRange(o.height_cm, 100, 250);
  if (h !== undefined) patch.heightCm = h;
  const w = inRange(o.weight_kg, 25, 400);
  if (w !== undefined) patch.weightKg = w;
  if (typeof o.activity_level === "string" && LEVELS.has(o.activity_level)) {
    patch.activityLevel = o.activity_level as ActivityLevel;
  }
  const d = inRange(o.target_deficit, 0, 1500);
  if (d !== undefined) patch.targetDeficit = d;
  return Object.keys(patch).length ? patch : null;
}

/**
 * Decide what the user wants. Recent turns are included so follow-ups like
 * "that was yesterday" resolve against what was actually just logged.
 */
export async function routeMessage(text: string, history: ChatTurn[] = []): Promise<Routing> {
  const messages: ChatMessage[] = [
    { role: "system", content: ROUTER_PROMPT },
    ...history.slice(-6).map((t) => ({ role: t.role, content: t.content }) as ChatMessage),
    { role: "user", content: text },
  ];
  const fallback: Routing = {
    intent: "log_meal",
    dayOffset: 0,
    mealType: null,
    burnedCalories: null,
    activity: null,
    profile: null,
  };
  try {
    const raw = await groqCompleter({ maxTokens: 250 })(messages);
    const p = extractJson(raw) as Record<string, unknown>;
    const intent =
      typeof p.intent === "string" && INTENTS.has(p.intent as Intent)
        ? (p.intent as Intent)
        : "log_meal";
    const rawOffset = typeof p.day_offset === "number" ? Math.round(p.day_offset) : 0;
    return {
      intent,
      // Clamp: a future date is never right, and beyond a week is a misread.
      dayOffset: Math.min(0, Math.max(-7, rawOffset)),
      mealType:
        typeof p.meal_type === "string" && MEAL_TYPES.has(p.meal_type)
          ? (p.meal_type as MealType)
          : null,
      burnedCalories: inRange(p.burned_calories, 1, 10_000) ?? null,
      activity: typeof p.activity === "string" && p.activity.trim() ? p.activity.trim() : null,
      profile: readProfile(p.profile),
    };
  } catch {
    // Routing is best-effort; logging a meal is the common case, so fail toward it.
    return fallback;
  }
}

/**
 * The assistant's conversational reply — questions and small talk both land here.
 * `context` carries the meal log, workouts and energy figures as plain text.
 */
export async function converse(
  text: string,
  context: string,
  history: ChatTurn[],
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: PERSONA },
    { role: "system", content: context },
    ...history.slice(-10).map((t) => ({ role: t.role, content: t.content }) as ChatMessage),
    { role: "user", content: text },
  ];
  return (await groqCompleter({ json: false, maxTokens: 500, temperature: 0.5 })(messages)).trim();
}
