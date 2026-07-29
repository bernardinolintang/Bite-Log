import { groqCompleter } from "@/lib/ai/analyze";
import type { ChatTurn } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/ai/types";
import type { MealType } from "@/lib/meals";

export type Intent = "log_meal" | "amend_date" | "converse";

export interface Routing {
  intent: Intent;
  /** 0 = today, -1 = yesterday. Applies to the meal being logged or amended. */
  dayOffset: number;
  /** Set only when the user names the meal explicitly ("yesterday's dinner"). */
  mealType: MealType | null;
}

const ROUTER_PROMPT = `You route messages sent to a personal meal-logging assistant.
Reply with ONLY a JSON object:
{"intent": "log_meal" | "amend_date" | "converse", "day_offset": number, "meal_type": "breakfast"|"lunch"|"dinner"|"snack"|null}

intent:
- "log_meal": they are telling you what they ate or drank, so you can log it.
  "chicken rice", "I had two eggs and toast", "just a flat white", "nasi lemak for lunch".
- "amend_date": they are correcting the day of something ALREADY logged.
  "that was yesterday", "I told you the sausage platter was from yesterday", "move that to Sunday".
  Only use this when they refer back to an earlier entry rather than naming new food.
- "converse": questions about their log or nutrition, greetings, thanks, anything else.
  "what did I eat today?", "how many calories so far", "ok nice", "thanks", "hey".

day_offset: 0 unless they say otherwise. "yesterday" or "last night" = -1.
"the day before yesterday" = -2. Only ever 0 or negative.

meal_type: only when they say it outright, otherwise null.

A bare food name with no question mark is almost always "log_meal".`;

const PERSONA = `You are BiteLog, a warm, concise personal nutrition assistant chatting on Telegram.

- Talk like a friend who happens to keep their food diary. Natural, brief, never clinical.
- 1-3 short sentences usually. This is a phone screen, not a report.
- Use the meal log for every factual claim. Never invent food, numbers, or days.
- If the log doesn't cover what they asked, say so and offer to log it.
- Numbers are estimates — don't over-claim precision. Round calories to whole numbers.
- Never comment on their body, weight, or discipline. No medical advice, no moralising
  about food choices. You are a record keeper, not a coach.
- Plain text only: no markdown, no asterisks, no headings, no bullet characters.
- Follow the conversation. If they refer to "that" or "it", look at what was just discussed.`;

function extractJson(raw: string): unknown {
  return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, ""));
}

const MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack"]);

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
  try {
    const raw = await groqCompleter({ maxTokens: 120 })(messages);
    const p = extractJson(raw) as { intent?: string; day_offset?: unknown; meal_type?: unknown };
    const intent: Intent =
      p.intent === "amend_date" || p.intent === "converse" || p.intent === "log_meal"
        ? p.intent
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
    };
  } catch {
    // Routing is best-effort; logging is the common case, so fail toward it.
    return { intent: "log_meal", dayOffset: 0, mealType: null };
  }
}

/** The assistant's conversational reply — questions and small talk both land here. */
export async function converse(
  text: string,
  logContext: string,
  history: ChatTurn[],
  todayDate: string,
  target: number | null,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: PERSONA },
    {
      role: "system",
      content: [
        `Today is ${todayDate}.`,
        target ? `Their daily calorie target is ${Math.round(target)} kcal.` : "No calorie target is set.",
        "",
        "Their meal log for the last 7 days (oldest first):",
        logContext,
      ].join("\n"),
    },
    ...history.slice(-10).map((t) => ({ role: t.role, content: t.content }) as ChatMessage),
    { role: "user", content: text },
  ];
  return (await groqCompleter({ json: false, maxTokens: 500, temperature: 0.5 })(messages)).trim();
}
