import OpenAI from "openai";
import { analysisSchema, type Analysis } from "./schema";
import { buildMessages } from "./prompt";
import type { AnalyzeInput, ChatMessage } from "./types";

export class AnalysisError extends Error {}

export type Completer = (messages: ChatMessage[]) => Promise<string>;

function extractJson(raw: string): unknown {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  return JSON.parse(trimmed);
}

export async function analyzeWith(complete: Completer, input: AnalyzeInput): Promise<Analysis> {
  const messages = buildMessages(input);
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptMessages: ChatMessage[] =
      attempt === 0
        ? messages
        : [
            ...messages,
            {
              role: "user",
              content: `Your previous reply was not valid (${lastError}). Reply again with ONLY the JSON object in the required shape.`,
            },
          ];
    let raw: string;
    try {
      raw = await complete(attemptMessages);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }
    let json: unknown;
    try {
      json = extractJson(raw);
    } catch {
      lastError = "response was not valid JSON";
      continue;
    }
    const parsed = analysisSchema.safeParse(json);
    if (parsed.success) return parsed.data;
    lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  throw new AnalysisError(`AI analysis failed: ${lastError}`);
}

export function groqCompleter(): Completer {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new AnalysisError("GROQ_API_KEY is not set");
  const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
  const model = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
  return async (messages) => {
    const res = await client.chat.completions.create({
      model,
      messages: messages as unknown as OpenAI.Chat.ChatCompletionMessageParam[],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_completion_tokens: 2000,
    });
    return res.choices[0]?.message?.content ?? "";
  };
}

export async function analyzeMeal(input: AnalyzeInput): Promise<Analysis> {
  return analyzeWith(groqCompleter(), input);
}
