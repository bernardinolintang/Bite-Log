import { groqCompleter } from "@/lib/ai/analyze";
import type { ChatMessage } from "@/lib/ai/types";

export type Intent = "log_meal" | "question" | "chat";

const INTENT_PROMPT = `You route messages sent to a personal meal-logging assistant.
Reply with ONLY a JSON object: {"intent": "log_meal" | "question" | "chat"}

- "log_meal": the user is telling you what they ate or drank, so it can be logged.
  Examples: "chicken rice", "I had two eggs and toast", "just a flat white", "nasi lemak for lunch".
- "question": they are asking about their food data or nutrition.
  Examples: "what did I eat today?", "how many calories so far?", "am I over my protein?",
  "what did I have yesterday", "how many calories left".
- "chat": greetings, thanks, small talk, or anything else.

A bare food name with no question mark is almost always "log_meal".`;

const ANSWER_PROMPT = `You are a friendly, concise personal nutrition assistant in a Telegram chat.
Answer the user's question using ONLY the meal log provided. Facts come from the log, never invented.

- Be brief: 1-3 short sentences, or a tight list. This is a phone screen.
- Round calories to whole numbers.
- If the log doesn't contain the answer, say so plainly and suggest logging the meal.
- Never comment on the user's body, weight, or discipline. No medical advice.
- These numbers are estimates; don't over-claim precision.
- Plain text only. No markdown, no asterisks, no headers.`;

function extractJson(raw: string): unknown {
  return JSON.parse(
    raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, ""),
  );
}

/** Classify a text message. Falls back to logging a meal, which is the common case. */
export async function classifyIntent(text: string): Promise<Intent> {
  const messages: ChatMessage[] = [
    { role: "system", content: INTENT_PROMPT },
    { role: "user", content: text },
  ];
  try {
    const raw = await groqCompleter({ maxTokens: 100 })(messages);
    const parsed = extractJson(raw) as { intent?: string };
    if (parsed.intent === "question" || parsed.intent === "chat" || parsed.intent === "log_meal") {
      return parsed.intent;
    }
  } catch {
    // Routing is best-effort; a failed classification shouldn't block logging.
  }
  return "log_meal";
}

export async function answerQuestion(
  question: string,
  logContext: string,
  todayDate: string,
  target: number | null,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: ANSWER_PROMPT },
    {
      role: "user",
      content: [
        `Today is ${todayDate}.`,
        target ? `Their daily calorie target is ${Math.round(target)} kcal.` : "No calorie target is set.",
        "",
        "Meal log (oldest first):",
        logContext,
        "",
        `Question: ${question}`,
      ].join("\n"),
    },
  ];
  return (await groqCompleter({ json: false, maxTokens: 500, temperature: 0.4 })(messages)).trim();
}
